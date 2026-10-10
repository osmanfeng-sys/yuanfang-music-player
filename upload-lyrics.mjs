#!/usr/bin/env node
/**
 * 远方音乐 —— 歌词后台上传工具（只在你本机跑）
 *
 * 不走 HTTP，直接写 R2 的 lyrics/ 前缀，用的是 `generate:playlist` 已经在用的那套
 * R2 S3 密钥（.env 里的 R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY）。
 * 因此不需要额外的上传密钥，也不存在任何公网可调用的写入接口 ——
 * 拿不到 R2 密钥就写不进去，这本身就是权限。
 *
 * 英文曲目照旧走 lrclib 自动匹配；中文曲目用这个脚本人工补。
 *
 * 用法（项目根目录）：
 *   npm run lyrics:list                         列出「曲目名 → 歌词 ID」
 *   npm run lyrics:upload -- ./lyrics           上传目录下所有 .lrc
 *   npm run lyrics:upload -- ./lyrics --dry-run 只预览不写入
 *
 * .lrc 文件名决定它归哪首歌，两种写法都认：
 *   1. 与曲目目录名完全一致     "郑源 - 一万个理由 [mqms2].lrc"
 *   2. 去掉版本后缀宽松匹配     "郑源 - 一万个理由.lrc"
 * 匹配不上或撞车的文件会被列出来，不会瞎猜。
 *
 * 编码：UTF-8 / GBK 都收（国内歌词站多是 GBK）。
 *
 * 新增歌曲后先跑 `npm run generate:playlist` 刷新 playlist.json，本脚本按它匹配。
 */
import { readdir, readFile } from 'node:fs/promises'
import { basename, extname, join, relative, sep } from 'node:path'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
// 复用前端同一套解析/ID 规则，保证和 loadLyrics() 查的是同一个 key
import { parseTrackName, generateTrackId } from './src/utils/parser.ts'

const ROOT = import.meta.dirname
const BUCKET = process.env.R2_BUCKET || 'music-bucket'

for (const v of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
  if (!process.env[v]) {
    console.error(`[Error] 缺少环境变量 ${v}。它和 npm run generate:playlist 用的是同一套，`)
    console.error('        确认项目根目录的 .env 里有这几项。')
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

/**
 * 写入 R2。key 与 Worker 的 GET /api/lyrics/:key 读的路径严格对应：
 *   worker: env.MUSIC.get(`lyrics/${url 路径最后一段}.json`)
 * ID 是 16 位十六进制，纯 ASCII，percent-encode 是空操作，两边自然对上。
 */
async function putLyric(track, lrcText) {
  const { artist, title } = parseTrackName(track.name)
  const id = generateTrackId(track.name)
  const record = {
    id,
    source: 'upload',
    synced: lrcText,
    artist,
    title,
    savedAt: new Date().toISOString()
  }
  await s3.send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: `lyrics/${id}.json`,
      Body: JSON.stringify(record),
      ContentType: 'application/json'
    })
  )
}

/**
 * 递归收集目录下的 .lrc，返回完整路径。
 *
 * 歌词在本地的放法有两种，都得吃下：和 mp3 同名的散在各个音乐夹里
 * （music/05_郑源/郑源 - 一万个理由.lrc），或集中在一个 Lyric/ 目录。
 * 所以两层都要能扫到 —— 传 music/ 时自动带上所有子夹。
 */
async function findLrc(root) {
  const out = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const p = join(root, entry.name)
    if (entry.isDirectory()) out.push(...(await findLrc(p)))
    else if (extname(entry.name).toLowerCase() === '.lrc') out.push(p)
  }
  return out
}

/** 宽松归一化：去掉 [..] (..) （..） 与空白，用于文件名兜底匹配 */
const loose = (s) =>
  s
    .replace(/[[(（][^\])）]*[\])）]/g, '')
    .replace(/\s+/g, '')
    .toLowerCase()

/** LRC 可能是 GBK（国内歌词站常见），UTF-8 严格解码失败时回退 GBK */
function decodeLrc(buf) {
  const b = buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf ? buf.subarray(3) : buf
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b)
  } catch {
    return new TextDecoder('gbk').decode(b)
  }
}

// ===== 主流程 =====

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const dir = args.find((a) => !a.startsWith('-'))

let tracks
try {
  tracks = JSON.parse(await readFile(join(ROOT, 'playlist.json'), 'utf8'))
} catch {
  console.error('[Error] 读不到 playlist.json。先跑：npm run generate:playlist')
  process.exit(1)
}
console.log(`曲目表：${tracks.length} 首（本地 playlist.json）`)

// --list 或没给目录：列出曲目名与对应 ID，供命名 .lrc 用
if (args.includes('--list') || !dir) {
  for (const t of tracks) console.log(`${t.name}\t${generateTrackId(t.name)}`)
  console.log('\n把 .lrc 按上面的曲目名命名，放进一个目录，再跑：')
  console.log('  npm run lyrics:upload -- <目录>')
  process.exit(0)
}

const byName = new Map(tracks.map((t) => [t.name, t]))
const byLoose = new Map()
for (const t of tracks) {
  const k = loose(t.name)
  byLoose.set(k, [...(byLoose.get(k) || []), t])
}

const files = await findLrc(dir)
if (files.length === 0) {
  console.error(`[Error] ${dir} 下没有 .lrc 文件（本工具只收 .lrc，不支持纯文本）`)
  process.exit(1)
}

let ok = 0
const problems = []

for (const f of files) {
  const rel = relative(dir, f).split(sep).join('/')
  const stem = basename(f, extname(f))
  let track = byName.get(stem)

  if (!track) {
    const cands = byLoose.get(loose(stem)) || []
    if (cands.length === 1) {
      track = cands[0]
    } else if (cands.length > 1) {
      problems.push([rel, `宽松匹配撞到 ${cands.length} 首，请改用完整曲目名`])
      continue
    }
  }

  if (!track) {
    problems.push([rel, '找不到对应曲目（用 npm run lyrics:list 看合法曲目名）'])
    continue
  }

  const lrc = decodeLrc(await readFile(f))
  if (dryRun) {
    console.log(`· ${rel}  →  ${track.name}   [dry-run]`)
    ok++
    continue
  }

  try {
    await putLyric(track, lrc)
    console.log(`✓ ${rel}  →  ${track.name}  (${generateTrackId(track.name)}.json)`)
    ok++
  } catch (e) {
    problems.push([rel, e.message])
  }
}

console.log(`\n${dryRun ? '[dry-run] ' : ''}成功 ${ok} / ${files.length}`)
if (problems.length) {
  console.log('\n失败或未能匹配：')
  for (const [f, why] of problems) console.log(`✗ ${f}  ${why}`)
  process.exit(1)
}
