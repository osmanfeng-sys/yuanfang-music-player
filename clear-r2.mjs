#!/usr/bin/env node
/**
 * 远方音乐 —— 清空 R2（音乐 + 歌词 + 索引），用于「本地全量重传」前重置。
 *
 * 默认 dry-run：只统计和列清单，一个字节都不删。
 * 确认清单无误后加 --yes 才真删。
 *
 *   node --env-file=.env clear-r2.mjs          预览
 *   node --env-file=.env clear-r2.mjs --yes    真删
 *
 * 注意 durations.json 必须一起删：upload-music.mjs 会把它读出来合并，
 * 留着旧的，重传后索引里会残留已删歌曲的时长条目。
 */
import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3'

const BUCKET = process.env.R2_BUCKET || 'music-bucket'
const yes = process.argv.includes('--yes')

for (const v of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
  if (!process.env[v]) {
    console.error(`[Error] 缺少环境变量 ${v}（和 generate:playlist 同一套，见 .env）`)
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

const mb = (n) => (n / 1024 / 1024).toFixed(1) + ' MB'

// ===== 全量列出 =====
const objects = []
let token
do {
  const r = await s3.send(new ListObjectsV2Command({ Bucket: BUCKET, ContinuationToken: token }))
  for (const o of r.Contents || []) objects.push({ key: o.Key, size: o.Size })
  token = r.IsTruncated ? r.NextContinuationToken : null
} while (token)

if (objects.length === 0) {
  console.log('桶里是空的，没什么可删。')
  process.exit(0)
}

// 按顶层前缀归类（音乐夹 / lyrics / 根目录文件各一类）
const groups = new Map()
let total = 0
for (const o of objects) {
  const top = o.key.includes('/') ? o.key.split('/')[0] + '/' : '(根目录文件)'
  const g = groups.get(top) || { n: 0, size: 0, index: [] }
  g.n++
  g.size += o.size
  // 根目录文件和 lyrics 只列名字，音乐夹只列前 3 首示例
  if (g.index.length < 3) g.index.push(o.key)
  groups.set(top, g)
  total += o.size
}

console.log(`\n桶：${BUCKET}    共 ${objects.length} 个对象，${mb(total)}\n`)
const top = [...groups.entries()].sort((a, b) => b[1].n - a[1].n)
for (const [name, g] of top) {
  const more = g.n > 3 ? ` … 等 ${g.n} 个` : ''
  console.log(`${name.padEnd(24)} ${String(g.n).padStart(5)} 个  ${mb(g.size).padStart(10)}`)
  console.log(`${' '.repeat(24)} ${g.index.join(' , ')}${more}`)
}

if (!yes) {
  console.log(`\n这是预览，什么都没删。确认上面就是要清掉的范围，加 --yes 执行：`)
  console.log(`  node --env-file=.env clear-r2.mjs --yes\n`)
  process.exit(0)
}

// ===== 真删：DeleteObjects 单次上限 1000 =====
let deleted = 0
for (let i = 0; i < objects.length; i += 1000) {
  const batch = objects.slice(i, i + 1000)
  const r = await s3.send(
    new DeleteObjectsCommand({
      Bucket: BUCKET,
      Delete: { Objects: batch.map((o) => ({ Key: o.key })), Quiet: true }
    })
  )
  if (r.Errors?.length) {
    console.error('[Error] 以下对象删除失败：')
    for (const e of r.Errors) console.error(`  ✗ ${e.Key}  ${e.Code} ${e.Message}`)
    process.exit(1)
  }
  deleted += batch.length
  console.log(`已删除 ${deleted} / ${objects.length}`)
}

console.log(`\n完成：R2 已清空（${deleted} 个对象，释放 ${mb(total)}）。`)
console.log('接下来：')
console.log('  1. npm run music:upload  -- "<本地音乐夹>"')
console.log('  2. npm run generate:playlist')
console.log('  3. npm run lyrics:upload -- "<本地音乐夹>"')
console.log('  4. deploy-music.bat')
