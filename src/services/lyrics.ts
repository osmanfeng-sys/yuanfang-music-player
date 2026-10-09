import { WORKER_BASE_URL } from '@/utils/constants'
import type { Track } from '@/types'

export interface LyricLine {
  time: number
  text: string
}

/** localStorage 缓存前缀 */
const CACHE_PREFIX = 'ym:lrc:'

/** 把 LRC 文本解析为按时间排序的歌词行 */
export function parseLrc(lrc: string): LyricLine[] {
  const lines: LyricLine[] = []
  for (const raw of lrc.split('\n')) {
    const m = raw.match(/^\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\](.*)$/)
    if (!m) continue
    const text = m[3].trim()
    if (!text) continue
    lines.push({ time: Number(m[1]) * 60 + Number(m[2]), text })
  }
  return lines.sort((a, b) => a.time - b.time)
}

/** 纯文本歌词（无时间轴）→ 每行 0 时间，不做滚动同步 */
function plainToLines(plain: string): LyricLine[] {
  return plain
    .split('\n')
    .map((t) => t.trim())
    .filter(Boolean)
    .map((text, i) => ({ time: i * 3, text }))
}

function readCache(id: string): LyricLine[] | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + id)
    if (!raw) return null
    const lines = JSON.parse(raw) as LyricLine[]
    return Array.isArray(lines) && lines.length > 0 ? lines : null
  } catch {
    return null
  }
}

function writeCache(id: string, lines: LyricLine[]) {
  try {
    localStorage.setItem(CACHE_PREFIX + id, JSON.stringify(lines))
  } catch {
    // 存储满时忽略
  }
}

/** 从云端（Worker + R2）读取歌词 */
async function fetchCloud(id: string): Promise<LyricLine[] | null> {
  try {
    const res = await fetch(`${WORKER_BASE_URL}/api/lyrics/${encodeURIComponent(id)}`)
    if (!res.ok) return null
    const data = await res.json()
    const text: string | undefined = data.synced || data.plain
    if (!text) return null
    return data.synced ? parseLrc(text) : plainToLines(text)
  } catch {
    return null
  }
}

/** 从 lrclib.net 在线匹配歌词 */
async function fetchFromLrclib(track: Track): Promise<{ synced?: string; plain?: string } | null> {
  try {
    const url =
      'https://lrclib.net/api/get' +
      `?artist_name=${encodeURIComponent(track.artist)}` +
      `&track_name=${encodeURIComponent(track.title)}`
    const res = await fetch(url, { headers: { 'Lrclib-Client': 'yuanfang-music-player v1.0' } })
    if (!res.ok) return null
    const data = await res.json()
    if (data.instrumental) return null
    const synced: string | undefined = data.syncedLyrics || undefined
    const plain: string | undefined = data.plainLyrics || undefined
    if (!synced && !plain) return null
    return { synced, plain }
  } catch {
    return null
  }
}

/**
 * 本次会话内已确认「云端没有这首歌的歌词」的曲目。
 *
 * 云端优先的代价是每切一首歌多问一次 R2；而 lyrics/ 目前大多数歌都还没有，
 * 不记一下就会反复问空。代价：本次会话内新上传的歌词要刷新页面才生效。
 * ponytail: 会话级内存记录，不做持久化；真需要热更新就改成带 TTL 的 localStorage。
 */
const cloudMiss = new Set<string>()

/**
 * 加载歌词：云端（R2，人工上传）→ 本地缓存 → 在线匹配（lrclib）
 *
 * 云端优先：R2 上的歌词是人工核对过的，可信度最高，放最前面才能让重新上传立即可见。
 * 本地缓存退居其后，只作为离线/加速兜底，不再挡住云端更新。
 *
 * 只读不写：R2 上的歌词由 `upload-lyrics.mjs` 在本机用 R2 S3 密钥直写，
 * 服务端没有任何写入接口，所以网页端也写不进来。
 */
export async function loadLyrics(track: Track): Promise<LyricLine[]> {
  if (!cloudMiss.has(track.id)) {
    const cloud = await fetchCloud(track.id)
    if (cloud) {
      writeCache(track.id, cloud)
      return cloud
    }
    cloudMiss.add(track.id)
  }

  const cached = readCache(track.id)
  if (cached) return cached

  const online = await fetchFromLrclib(track)
  if (!online) return []

  const lines = online.synced ? parseLrc(online.synced) : plainToLines(online.plain!)
  if (lines.length === 0) return []

  writeCache(track.id, lines)
  return lines
}
