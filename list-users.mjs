#!/usr/bin/env node
/**
 * 远方音乐 —— 后台：看看有多少人来过、他们自称什么 ID。
 *
 *   node --env-file=.env list-users.mjs
 *
 * 数据来源：worker/src/routes/playlists.ts 在 GET /api/playlists 里
 * 首次到场时写的那份 user-playlists/<key>/seen.json（每个用户只写一次）。
 *
 * ⚠️ 这份名单**只能当"大概谁在用"，不能当可信登录记录**：
 *   · key 是 sha256("<ID>:<密码>") 的前 22 位，不可逆 —— 反推不回 ID
 *   · 这里显示的 ID 是前端用 X-User-Id 带上来的**自称**，
 *     而那套接口没有任何鉴权，谁都能伪造
 *   · 只统计「配了歌单同步凭据、且至少打开过一次首页」的人；
 *     没设凭据的（歌单只存本机）根本不在服务端留痕
 *
 * 输出是**逗号分隔的纯文本**，方便直接粘走。
 */
import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3'

const BUCKET = process.env.R2_BUCKET || 'music-bucket'

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

async function readJson(key) {
  try {
    const r = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }))
    return JSON.parse(await r.Body.transformToString())
  } catch {
    return null
  }
}

// ===== 列举 user-playlists/ 下所有对象 =====
const keys = []
let token
do {
  const r = await s3.send(
    new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: 'user-playlists/',
      ContinuationToken: token,
      MaxKeys: 1000
    })
  )
  for (const o of r.Contents || []) keys.push(o.Key)
  token = r.IsTruncated ? r.NextContinuationToken : null
} while (token)

// ===== 按 uid 归组 =====
// key 形状固定是 user-playlists/<uid>/<file>，所以按 '/' 切三段就够
const users = new Map()
for (const k of keys) {
  const parts = k.split('/')
  if (parts.length < 3) continue
  const uid = parts[1]
  const u = users.get(uid) ?? { uid, seenKey: null, indexKey: null }
  if (parts[2] === 'seen.json') u.seenKey = k
  if (parts[2] === 'index.json') u.indexKey = k
  users.set(uid, u)
}

if (users.size === 0) {
  console.log('还没有人来过（user-playlists/ 下是空的）。')
  process.exit(0)
}

// ===== 逐人取明细 =====
const rows = []
for (const u of users.values()) {
  const seen = u.seenKey ? await readJson(u.seenKey) : null
  const index = u.indexKey ? await readJson(u.indexKey) : null
  rows.push({
    id: seen?.id || '(未上报)',
    short: u.uid.slice(0, 8),
    firstSeen: seen?.firstSeen || '(无记录)', // 只有建过歌单、没见过 seen 的老用户会到这
    playlists: Array.isArray(index) ? index.length : 0,
    tracks: Array.isArray(index)
      ? index.reduce((n, p) => n + (Array.isArray(p.trackIds) ? p.trackIds.length : 0), 0)
      : 0
  })
}

// 新来的排前面
rows.sort((a, b) => String(b.firstSeen).localeCompare(String(a.firstSeen)))

console.log('序号,ID,key前8位,首次到场,歌单数,曲目数')
rows.forEach((r, i) => {
  console.log(`${i + 1},${r.id},${r.short},${r.firstSeen},${r.playlists},${r.tracks}`)
})

const withPlaylists = rows.filter((r) => r.playlists > 0).length
console.log('')
console.log(`合计 ${rows.length} 人来过，其中 ${withPlaylists} 人建过歌单。`)
console.log('（注意：这是下界 —— 没配凭据、歌单只存本机的人不在其中）')
