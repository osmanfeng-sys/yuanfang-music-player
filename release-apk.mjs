#!/usr/bin/env node
/**
 * 远方音乐 —— 发版：把刚构建好的 APK 传到 R2，并生成 version.json。
 *
 *   node --env-file=.env release-apk.mjs                     预览（什么都不传）
 *   node --env-file=.env release-apk.mjs --yes               真传
 *   node --env-file=.env release-apk.mjs --notes "改了xx" --yes
 *
 * 一条命令做完三件事，避免手工同步出错：
 *   ① 从 android/app/build.gradle 读 versionCode / versionName
 *   ② 传 APK 到 R2：apk/yuanfang-music-<versionName>.apk
 *   ③ 写 R2 的 version.json —— 客户端「检查更新」读的就是它
 *
 * ⚠️ version.json **必须由本脚本生成，不要手写**：
 *    手写会和 build.gradle 漂移，后果是「永远提示更新」或「永远不提示」，两种都很难查。
 *
 * ⚠️ 发之前先确认签名没变。Android 只允许同签名的包覆盖安装；
 *    换签名意味着用户必须卸载重装（会清掉 localStorage）。签名固定在
 *    android/keystore.properties + yuanfang-release.jks（两者都已 gitignore）。
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

const BUCKET = process.env.R2_BUCKET || 'music-bucket'
const yes = process.argv.includes('--yes')
const notesIdx = process.argv.indexOf('--notes')
const notes = notesIdx !== -1 ? (process.argv[notesIdx + 1] ?? '') : ''

for (const v of ['R2_ENDPOINT', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY']) {
  if (!process.env[v]) {
    console.error(`[Error] 缺少环境变量 ${v}（和 generate:playlist 同一套，见 .env）`)
    process.exit(1)
  }
}

// ===== ① 从 build.gradle 读版本号 =====
const GRADLE = 'android/app/build.gradle'
let gradleText
try {
  gradleText = readFileSync(GRADLE, 'utf8')
} catch {
  console.error(`[Error] 读不到 ${GRADLE}`)
  process.exit(1)
}

const codeMatch = gradleText.match(/versionCode\s+(\d+)/)
const nameMatch = gradleText.match(/versionName\s+"([^"]+)"/)
if (!codeMatch || !nameMatch) {
  console.error('[Error] 在 build.gradle 里找不到 versionCode / versionName')
  process.exit(1)
}
const versionCode = Number(codeMatch[1])
const versionName = nameMatch[1]

// ===== ② 找 APK =====
//
// 优先取【确定版】：build.gradle 里 release 构建输出的是 yuanfang-music_V1.1.apk
// （不带时间、带版本号），debug 构建输出的是 yuanfang-music_2113.apk（带构建时刻）。
// 调试包随时可能比确定版新，但该发布的是确定版 —— 所以先看 release 目录，
// 那里没有才退回 debug 目录取最新的。
const APK_DIRS = [
  'android/app/build/outputs/apk/release',
  'android/app/build/outputs/apk/debug'
]

function newestApksIn(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.apk'))
      .map((f) => join(dir, f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)
  } catch {
    return [] // 目录还不存在（没打过这种包）
  }
}

let apkPath = null
for (const dir of APK_DIRS) {
  const apks = newestApksIn(dir)
  if (apks.length > 0) {
    apkPath = apks[0]
    break
  }
}

if (!apkPath) {
  console.error('[Error] 两个输出目录里都没有 APK。先构建：')
  console.error('        正式包  cd android && gradlew assembleRelease')
  console.error('        调试包  cd android && gradlew assembleDebug')
  process.exit(1)
}

const buf = readFileSync(apkPath)
const sha256 = createHash('sha256').update(buf).digest('hex')
const apkKey = `apk/yuanfang-music-${versionName}.apk`

// url 用**相对路径**（和 playlist.json 里的音频 URL 同一个思路）：
// 换域名不用改数据，客户端 window.open 会按当前 origin 解析
const manifest = {
  versionCode,
  versionName,
  url: `/proxy/${apkKey}`,
  notes,
  publishedAt: new Date().toISOString()
}

console.log('')
console.log(`  版本      ${versionName}  (versionCode ${versionCode})`)
console.log(`  APK       ${apkPath}`)
console.log(`  大小      ${(buf.length / 1024 / 1024).toFixed(2)} MB`)
console.log(`  SHA-256   ${sha256}`)
console.log(`  上传到    ${BUCKET}/${apkKey}`)
console.log(`  清单      ${BUCKET}/version.json`)
console.log(`            ${JSON.stringify(manifest)}`)
console.log('')

if (!yes) {
  console.log('这是预览，什么都没传。确认无误后加 --yes：')
  console.log(`  node --env-file=.env release-apk.mjs${notes ? ` --notes "${notes}"` : ''} --yes`)
  console.log('')
  process.exit(0)
}

const s3 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
  }
})

await s3.send(
  new PutObjectCommand({
    Bucket: BUCKET,
    Key: apkKey,
    Body: buf,
    ContentType: 'application/vnd.android.package-archive'
  })
)
console.log(`已上传 APK：${apkKey}`)

await s3.send(
  new PutObjectCommand({
    Bucket: BUCKET,
    Key: 'version.json',
    Body: JSON.stringify(manifest, null, 2),
    ContentType: 'application/json'
  })
)
console.log('已写入 version.json')

console.log('')
console.log('完成。客户端下次打开就会看到更新提示（versionCode 比它本地大时）。')
console.log('验证： curl https://yuanfang-music.pages.dev/api/version')
console.log('')
