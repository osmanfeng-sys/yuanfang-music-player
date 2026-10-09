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
import { readdir, readFile, mkdtemp, rm, stat } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, sep } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createInterface } from 'node:readline/promises'
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
let folder = folderFlag !== -1 ? argv[folderFlag + 1] : null
let srcDir = argv.find((a, i) => !a.startsWith('-') && i !== folderFlag + 1)

if (folderFlag !== -1 && !folder) {
  console.error('[Error] --folder 后面要跟音乐夹名，例如 --folder "06_网络歌曲"')
  process.exit(1)
}

// 没有任何参数（双击 upload-music.bat 的场景）→ 交互式收集。
// 交互放在这里而不是 bat 里：cmd 解析含中文的括号块会错位，Node 没有这个毛病。
if (argv.length === 0) {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  const clean = (s) => s.trim().replace(/^"(.*)"$/, '$1') // 拖进来的路径带引号

  // 非 TTY（管道 / 重定向）下 stdin 读完即 EOF，之后再 question 会永远挂着
  // （Node 直接报 "unsettled top-level await"）。所以那种情况先一次性读完，再逐行
  // 按序「回答」；TTY（双击 bat 的真实场景）走正常的实时提问。
  let scripted = null
  if (!process.stdin.isTTY) {
    scripted = []
    for await (const line of rl) scripted.push(line)
  }
  const ask = async (q) => {
    process.stdout.write(q)
    if (scripted) {
      const v = scripted.shift() ?? ''
      process.stdout.write(v + '\n')
      return v
    }
    return rl.question('')
  }

  srcDir = clean(
    await ask('源路径（音乐文件夹或单个 mp3，可把文件直接拖进本窗口）:\n> ')
  )
  const st = srcDir ? await stat(srcDir).catch(() => null) : null
  if (!st) {
    rl.close()
    console.error(`\n[Error] 路径不存在：${srcDir || '(空)'}`)
    process.exit(1)
  }

  console.log(
    st.isFile()
      ? '\n单个文件必须指定音乐夹 —— 否则会落在 R2 根目录，列表里归入「未分类」。'
      : '\n音乐夹名留空 = 用本地目录名映射（D:\\传\\05_郑源\\x.mp3 → R2 的 05_郑源/x.mp3）'
  )
  const answer = clean(await ask('音乐夹名（如 06_网络歌曲）:\n> '))
  if (answer) folder = answer
  if (st.isFile() && !folder) {
    rl.close()
    console.error('\n[取消] 单个文件没有指定音乐夹。')
    process.exit(1)
  }

  const ok = clean(
    await ask(
      `\n源  ：${srcDir}\n目标：${folder ? `音乐夹「${folder}」` : '按本地目录名映射到 R2'}\n确认上传？(Y/N) > `
    )
  )
  rl.close()
  if (!/^y(es)?$/i.test(ok)) {
    console.log('[取消]')
    process.exit(0)
  }
  console.log()
}

if (!srcDir) {
  console.error('用法：npm run music:upload -- <本地目录或单个 mp3> [--folder "音乐夹名"] [--dry-run]')
  console.error('  不给 --folder 时，本地目录名即音乐夹名（目录结构原样映射到 R2）')
  console.error('  不带任何参数直接跑（或双击 upload-music.bat）则进入交互模式')
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

// 源可以是目录，也可以是单个 .mp3 文件
const srcStat = await stat(srcDir).catch(() => null)
if (!srcStat) {
  console.error(`[Error] 路径不存在：${srcDir}`)
  process.exit(1)
}
const isSingleFile = srcStat.isFile()
// 单文件时以它所在目录为基准，这样 key 就是文件名本身
const baseDir = isSingleFile ? dirname(srcDir) : srcDir
const files = isSingleFile
  ? extname(srcDir).toLowerCase() === '.mp3'
    ? [srcDir]
    : []
  : await findMp3(srcDir)

if (files.length === 0) {
  console.error(`[Error] ${srcDir} 下没有 .mp3 文件`)
  process.exit(1)
}
if (isSingleFile && !folder) {
  console.warn('[提示] 单个文件没给 --folder，它会落在 R2 根下，列表里归入「未分类」')
}

console.log(
  `${dryRun ? '[dry-run] ' : ''}源${isSingleFile ? '文件' : '目录'}：${srcDir}    找到 ${files.length} 首`
)
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
    : relative(baseDir, file).split(sep).join('/')

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
