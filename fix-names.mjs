#!/usr/bin/env node
/**
 * 远方音乐 —— 把「歌手-歌名」（连字符两侧都没空格）规范成「歌手 - 歌名」。
 *
 * 起因：库里 354 首是「歌手 - 歌名」，另有 35 首是「蔡依林-日不落」这种
 * 两侧都无空格的写法。parser 的两种规则都要求连字符【前】有空格，认不出这 35 首，
 * 会把整串当歌名、艺人显示 Unknown。
 *
 * 默认 dry-run，只列清单；加 --yes 才真的改名。
 *   node fix-names.mjs ./music
 *   node fix-names.mjs ./music --yes
 *
 * 规则：名字含 '-' 但【没有任何「空格+连字符」】的才动，且只替换第一个 '-'。
 *   "蔡依林-日不落"                        → "蔡依林 - 日不落"
 *   "蓝鲤鱼-LLY-Takvi Kao Ti (蓝鲤鱼-DJ…)"  → "蓝鲤鱼 - LLY-Takvi Kao Ti (蓝鲤鱼-DJ…)"  只动第一个
 *   "Aqua - Back To The 80's"              已有「空格+连字符」→ 不动
 *
 * .mp3 和 .lrc 一起改。lrc 改名不影响匹配（upload-lyrics.mjs 的宽松匹配本就忽略空格），
 * 纯粹是为了本地文件整齐；真正必须改的是 mp3 —— 它的名字决定 R2 key 和曲目 ID。
 */
import { readdir, rename, access } from 'node:fs/promises'
import { basename, dirname, extname, join, relative, sep } from 'node:path'

const ROOT = process.argv.slice(2).find((a) => !a.startsWith('-')) || './music'
const yes = process.argv.includes('--yes')

/** 递归收集全部文件 */
async function walk(dir, out = []) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name)
    if (e.isDirectory()) await walk(p, out)
    else out.push(p)
  }
  return out
}

/** 含连字符、且没有任何「空格+连字符」→ 属于要规范的那一类 */
const needsFix = (stem) => /-/.test(stem) && !/[ \t]-/.test(stem)

const exists = (p) => access(p).then(() => true, () => false)

const files = await walk(ROOT)
const jobs = []

for (const f of files) {
  const ext = extname(f)
  if (!/\.(mp3|lrc)$/i.test(ext)) continue
  const stem = basename(f, ext)
  if (!needsFix(stem)) continue
  jobs.push({ from: f, to: join(dirname(f), stem.replace('-', ' - ') + ext) })
}

if (jobs.length === 0) {
  console.log('没有需要规范的文件。')
  process.exit(0)
}

const mp3n = jobs.filter((j) => /\.mp3$/i.test(j.from)).length
const lrcn = jobs.filter((j) => /\.lrc$/i.test(j.from)).length
console.log(`\n待规范：${jobs.length} 个（mp3 ${mp3n} / lrc ${lrcn}）\n`)

let conflict = 0
for (const j of jobs) {
  const rel = (p) => relative(ROOT, p).split(sep).join('/')
  if (await exists(j.to)) {
    console.log(`✗ 冲突（目标已存在，跳过）：${rel(j.from)}`)
    conflict++
    continue
  }
  console.log(`${rel(j.from)}\n  → ${rel(j.to)}`)
}

if (!yes) {
  console.log(`\n这是预览，什么都没改。确认无误后加 --yes 执行。\n`)
  process.exit(0)
}

let done = 0
for (const j of jobs) {
  if (await exists(j.to)) continue
  await rename(j.from, j.to)
  done++
}

console.log(`\n完成：改名 ${done} 个${conflict ? `，跳过 ${conflict} 个冲突` : ''}。`)
