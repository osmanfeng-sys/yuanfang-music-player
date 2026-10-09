#!/usr/bin/env node
/**
 * 远方音乐 —— mp3 原文件上传工具（只在你本机跑）
 *
 * 取代原来「本机 ffmpeg 切片成 HLS → 逐个上传分片」的流程：现在直接把 mp3 传上 R2，
 * 前端按 URL 后缀自适应播放（mp3 走原生 Range 流式，老 HLS 仍走 hls.js）。
 *
 * 用的是 `generate:playlist` 那套 R2 S3 密钥（.env），没有公网写入接口。
 *
 * 用法（项目根目录）：
 *   npm run music:upload -- ./music --folder "06_网络歌曲"   整个目录传进指定音乐夹
 *   npm run music:upload -- ./music-upload                  本地目录名即音乐夹，原样映射
 *   npm run music:upload -- ./music --dry-run               只预览不写入
 *
 * 上传前会做两件事（都是为了让浏览器更快出声）：
 *   1. ffmpeg -c:a copy -vn 剥掉内嵌封面 —— 封面（APIC）动辄几百 KB 且在文件头部，
 *      浏览器得先越过它才能解码出声。音频流是 copy 的，无损、秒级。
 *   2. ffprobe 读时长，写进对象元数据并汇总进 R2 的 durations.json
 *      （索引脚本读它一次就有全部时长，不必逐对象 HEAD）。
 *
 * 传完记得跑 `npm run generate:playlist` 刷新索引，再 push 触发部署。
 */
import { readdir, readFile, mkdtemp, rm } from 'node:fs/promises'
import { basename, extname, join, relative, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'

const run = promisify(execFile)

const BUCKET = process.env.R2_BUCKET || 'music-bucket'
const DURATIONS_KEY = 'durations.json'

/** 超过这个码率在国内链路上大概率卡顿（实测到 CF 约 50 KB/s） */
const BITRATE_WARN = 192_000

/** 并发上传数：太高会打满上传带宽，5 是稳妥值 */
const CONCURRENCY = 5

for (const v of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
  if (!process.env[v]) {
    console.error(`[Error] 缺少环境变量 ${v}（和 npm run generate:playlist 用同一套，见 .env）`)
    process.exit(1)
  }
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

// ===== 参数 =====

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const folderFlag = argv.indexOf('--folder')
const folder = folderFlag !== -1 ? argv[folderFlag + 1] : null
const srcDir = argv.find((a, i) => !a.startsWith('-') && i !== folderFlag + 1)

if (!srcDir) {
  console.error('用法：npm run music:upload -- <本地目录> [--folder "音乐夹名"] [--dry-run]')
  console.error('  不给 --folder 时，本地目录名即音乐夹名（目录结构原样映射到 R2）')
  process.exit(1)
}
if (folderFlag !== -1 && !folder) {
  console.error('[Error] --folder 后面要跟音乐夹名，例如 --folder "06_网络歌曲"')
  process.exit(1)
}

// ===== 工具函数 =====

/** 递归收集目录下的 .mp3 */
async function findMp3(dir) {
  const out = []
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...(await findMp3(p)))
    else if (extname(entry.name).toLowerCase() === '.mp3') out.push(p)
  }
  return out
}

/** 读时长 / 码率 / 是否带内嵌封面 */
async function probe(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,bit_rate',
    '-show_entries', 'stream=codec_type',
    '-of', 'json',
    file
  ])
  const j = JSON.parse(stdout)
  return {
    duration: Number(j.format?.duration) || 0,
    bitrate: Number(j.format?.bit_rate) || 0,
    hasCover: (j.streams || []).some((s) => s.codec_type === 'video')
  }
}

/** 剥掉内嵌封面：只取音频流并 copy，不重编码 */
async function stripCover(file, out) {
  await run('ffmpeg', ['-y', '-v', 'error', '-i', file, '-map', '0:a', '-c:a', 'copy', '-vn', out])
}

/** 读 R2 上已有的 durations.json，读不到就返回空表 */
async function loadDurations() {
  try {
    const obj = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: DURATIONS_KEY }))
    return JSON.parse(await obj.Body.transformToString())
  } catch {
    return {}
  }
}

// ===== 主流程 =====

const files = await findMp3(srcDir)
if (files.length === 0) {
  console.error(`[Error] ${srcDir} 下没有 .mp3 文件`)
  process.exit(1)
}

console.log(`${dryRun ? '[dry-run] ' : ''}源目录：${srcDir}    找到 ${files.length} 首`)
console.log(`目标位置：${folder ? `音乐夹「${folder}」下` : '按本地目录结构原样映射'}\n`)

const tmp = await mkdtemp(join(tmpdir(), 'ym-upload-'))
const durations = await loadDurations()
const uploaded = []
const problems = []
const warnings = []

/** 处理一首：探测 → 剥封面 → 上传 */
async function handle(file, idx) {
  const stem = basename(file, extname(file))
  const key = folder
    ? `${folder}/${stem}.mp3`
    : relative(srcDir, file).split(sep).join('/')

  // 文件名不符合「歌手 - 歌名」时，前端会把它整个当歌名、艺人显示 Unknown
  if (!/\s-\s/.test(stem)) {
    warnings.push(`${stem}  —— 文件名没有「歌手 - 歌名」格式，列表里艺人会显示 Unknown`)
  }

  let info
  try {
    info = await probe(file)
  } catch (e) {
    problems.push([key, `ffprobe 失败：${e.message}`])
    return
  }

  if (info.bitrate > BITRATE_WARN) {
    warnings.push(
      `${stem}  —— ${Math.round(info.bitrate / 1000)} kbps，超过 ${BITRATE_WARN / 1000} kbps，` +
      `国内链路上可能卡顿（现在约 50 KB/s 带宽）`
    )
  }

  const mm = String(Math.floor(info.duration / 60)).padStart(2, '0')
  const ss = String(Math.round(info.duration % 60)).padStart(2, '0')
  const tag = `${mm}:${ss}  ${Math.round(info.bitrate / 1000)}kbps${info.hasCover ? '  [有封面→剥掉]' : ''}`

  if (dryRun) {
    console.log(`· [${idx + 1}/${files.length}] ${stem}\n    → ${key}    ${tag}   [dry-run]`)
    uploaded.push(key)
    return
  }

  try {
    // 剥封面后上传；音频流是 copy 的，音质不变
    const stripped = join(tmp, `${idx}.mp3`)
    await stripCover(file, stripped)

    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: await readFile(stripped),
        ContentType: 'audio/mpeg',
        Metadata: { duration: String(Math.round(info.duration)) }
      })
    )

    durations[key] = Math.round(info.duration)
    uploaded.push(key)
    console.log(`✓ [${idx + 1}/${files.length}] ${stem}\n    → ${key}    ${tag}`)
  } catch (e) {
    problems.push([key, e.message])
  }
}

// 分批并发
for (let i = 0; i < files.length; i += CONCURRENCY) {
  await Promise.all(files.slice(i, i + CONCURRENCY).map((f, k) => handle(f, i + k)))
}

// 把时长表写回 R2（索引脚本读它，省掉逐对象 HEAD）
if (!dryRun && uploaded.length > 0) {
  try {
    await s3.send(
      new PutObjectCommand({
        Bucket: BUCKET,
        Key: DURATIONS_KEY,
        Body: JSON.stringify(durations, null, 2),
        ContentType: 'application/json'
      })
    )
    console.log(`\n时长表已更新：${DURATIONS_KEY}（共 ${Object.keys(durations).length} 条）`)
  } catch (e) {
    problems.push([DURATIONS_KEY, `时长表写入失败：${e.message}`])
  }
}

await rm(tmp, { recursive: true, force: true })

console.log(`\n${dryRun ? '[dry-run] ' : ''}成功 ${uploaded.length} / ${files.length}`)

if (warnings.length) {
  console.log('\n注意：')
  for (const w of warnings) console.log(`! ${w}`)
}
if (problems.length) {
  console.log('\n失败：')
  for (const [k, why] of problems) console.log(`✗ ${k}  ${why}`)
  process.exit(1)
}
if (!dryRun) {
  console.log('\n下一步：npm run generate:playlist  然后 git push 触发部署')
}
