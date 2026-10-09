import type { ParsedTrackName } from '@/types'

/**
 * 解析 Track 原始 name 字段为 artist 和 title。
 *
 * 支持三种格式：
 *   1. "Artist - Title"（标准）
 *   2. "Artist- Title"（无前半空格）
 *   3. 纯文本（无分隔符）→ 整个当标题，artist 为 "Unknown"
 *
 * 同时清理 [mqms2] 等尾缀。
 */
export function parseTrackName(rawName: string): ParsedTrackName {
  const dashPattern = /^(.+?)\s*-\s+(.+)$/
  const match = rawName.match(dashPattern)

  if (match) {
    let artist = match[1].trim()
    let title = match[2].trim()
    // 清理 [mqms2] 等后缀
    title = title.replace(/\s*\[.*?\]\s*$/, '').trim()
    return { artist, title }
  }

  // 变体："歌手 -歌名"（连字符前有空格、后面没有）。
  // 不少从各处下载来的文件长这样（如「于浩东 -我正年少」），上面的规则只认
  // 连字符【后】有空格的形式，会把它整段当成歌名、艺人显示 Unknown。
  const tightDash = /^(.+?)\s+-\s*(.+)$/
  const tight = rawName.match(tightDash)
  if (tight) {
    const artist = tight[1].trim()
    const title = tight[2].replace(/\s*\[.*?\]\s*$/, '').trim()
    if (artist && title) return { artist, title }
  }

  // Fallback: 没有分隔符 → 整段当标题
  return { artist: 'Unknown', title: rawName.trim() }
}

/**
 * 从 R2 路径提取人工可读的 Track 名称。
 * 路径格式通常为 "Artist Name/Track Name/playlist.m3u8"
 */
export function extractNameFromPath(path: string): string {
  // 取倒数第二段（曲目目录名）
  const parts = path.split('/').filter(Boolean)
  if (parts.length >= 2) {
    return parts[parts.length - 2]
  }
  return path
}

/**
 * 生成稳定的 Track ID：对**原始曲目名**做 FNV-1a 64 位哈希，输出 16 位十六进制。
 *
 * 为什么不用 "artist_title" slug：parseTrackName 会剥掉 "[mqms2]" 这类后缀，
 * 于是同一首歌的重复上传算成同一个 ID（实测 7 组 / 14 首撞车，播一首会同时高亮两行）。
 * 哈希吃的是未经解析的原始 name，天然唯一。
 *
 * 附带好处：输出纯 ASCII，做 R2 的歌词 key 时 percent-encode 是空操作，
 * 中文曲目不会再写成一堆 %E9%83%91... 的 key。
 *
 * 注意：Worker 侧 `worker/src/utils/response.ts` 有同名同算法的副本，
 * 两处必须保持一致，否则前端算出的歌词 key 会读不到云端歌词。
 *
 * ponytail: 非加密哈希。5000 首规模碰撞概率约 7e-13，够用；
 * 真需要更强就换 SHA-256，代价是整条链路要异步化。
 */
export function generateTrackId(rawName: string): string {
  const PRIME = 0x100000001b3n
  const MASK = 0xffffffffffffffffn
  let h = 0xcbf29ce484222325n
  for (let i = 0; i < rawName.length; i++) {
    h = ((h ^ BigInt(rawName.charCodeAt(i))) * PRIME) & MASK
  }
  return h.toString(16).padStart(16, '0')
}
