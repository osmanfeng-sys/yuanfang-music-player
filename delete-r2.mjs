#!/usr/bin/env node
/**
 * 远方音乐 —— 删除 R2 上指定的音乐（连带它的歌词）。
 *
 *   node --env-file=.env delete-r2.mjs "15_恐怖歌曲/装逼遭雷劈(装纯遭人轮).mp3"         预览
 *   node --env-file=.env delete-r2.mjs "15_恐怖歌曲/装逼遭雷劈(装纯遭人轮).mp3" --yes   真删
 *
 * 为什么不用 clear-r2.mjs：那个是「清空整桶」，用来做全量重传前的重置，删不了单首。
 *
 * 歌词键是 lyrics/<trackId>.json，trackId 由文件名（去掉扩展名）哈希而来 ——
 * 与 src/utils/parser.ts 及 worker/src/utils/response.ts 的 generateTrackId 同一套
 * FNV-1a 64 位。**那边改了这里要跟着改**，否则会漏删歌词。
 * （注意哈希的是「原始名」，带 [mqms] 这类后缀的名和不带的算两首、两个歌词 ID。）
 *
 * 删完必须重建索引并推送，否则列表里还留着这条：
 *   npm run generate:playlist && git add playlist.json && git commit && git push
 * durations.json 里的旧时长条目留着无害（索引以 playlist.json 为准）。
 */
import { S3Client, HeadObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const BUCKET = process.env.R2_BUCKET || 'music-bucket'
const argv = process.argv.slice(2)
const yes = argv.includes('--yes')
const keys = argv.filter((a) => !a.startsWith('--'))

for (const v of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
  if (!process.env[v]) {
    console.error(`[Error] 缺少环境变量 ${v}（和 generate:playlist 同一套，见 .env）`)
    process.exit(1)
  }
}

if (keys.length === 0) {
  console.error('用法: node --env-file=.env delete-r2.mjs "<R2 对象键>" [--yes]')
  process.exit(1)
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

/** 必须与 parser.ts / response.ts 的 generateTrackId 完全一致 */
function generateTrackId(rawName) {
  const PRIME = 0x100000001b3n
  const MASK = 0xffffffffffffffffn
  let h = 0xcbf29ce484222325n
  for (let i = 0; i < rawName.length; i++) {
    h = ((h ^ BigInt(rawName.charCodeAt(i))) * PRIME) & MASK
  }
  return h.toString(16).padStart(16, '0')
}

async function sizeOf(key) {
  try {
    const r = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }))
    return r.ContentLength
  } catch {
    return null // 不存在（或没权限，两种情况都当"没有"处理，反正删不动）
  }
}

const fmt = (n) => (n >= 1024 * 1024 ? (n / 1024 / 1024).toFixed(2) + ' MB' : (n / 1024).toFixed(1) + ' KB')

// 每个音乐键 → 它自己 + 由文件名推导出的歌词键
const targets = []
for (const key of keys) {
  targets.push({ key, kind: '音乐' })
  const base = key.split('/').pop().replace(/\.[^.]+$/, '')
  targets.push({ key: `lyrics/${generateTrackId(base)}.json`, kind: '歌词' })
}

console.log(`\n桶：${BUCKET}\n`)

const found = []
for (const t of targets) {
  const size = await sizeOf(t.key)
  if (size === null) {
    console.log(`  —  ${t.kind}不存在，跳过：${t.key}`)
  } else {
    console.log(`  ✓  ${t.kind}  ${fmt(size).padStart(9)}  ${t.key}`)
    found.push(t)
  }
}

if (found.length === 0) {
  console.log('\n没有任何可删的对象。检查键名是否写对了（中文、括号、扩展名都要一致）。\n')
  process.exit(1)
}

// 「跳过」比「找不到」更需要提示：键名打错时每个都不存在，很容易被当成"删掉了"
console.log(`\n以上 ${found.length} 个对象将被删除。`)

if (!yes) {
  console.log('这是预览，什么都没删。确认无误后加 --yes 执行：')
  console.log(`  node --env-file=.env delete-r2.mjs ${keys.map((k) => `"${k}"`).join(' ')} --yes\n`)
  process.exit(0)
}

for (const t of found) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: t.key }))
  console.log(`已删除 ${t.kind}：${t.key}`)
}

console.log('\n完成。接下来必须重建索引并推送，否则列表里还留着这首：')
console.log('  npm run generate:playlist')
console.log('  git add playlist.json && git commit -m "chore: 删除 <歌名>" && git push\n')
