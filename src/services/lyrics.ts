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

/** 保存歌词到云端 */
async function saveCloud(
  track: Track,
  payload: { synced?: string; plain?: string }
): Promise<void> {
  try {
    await fetch(`${WORKER_BASE_URL}/api/lyrics/${encodeURIComponent(track.id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'lrclib',
        artist: track.artist,
        title: track.title,
        ...payload
      })
    })
  } catch {
    // 云端保存失败不阻塞播放
  }
}

/**
 * 加载歌词：本地缓存 → 云端 → 在线匹配（命中后回写云端 + 本地）
 */
export async function loadLyrics(track: Track): Promise<LyricLine[]> {
  const cached = readCache(track.id)
  if (cached) return cached

  const cloud = await fetchCloud(track.id)
  if (cloud) {
    writeCache(track.id, cloud)
    return cloud
  }

  const online = await fetchFromLrclib(track)
  if (!online) return []

  const lines = online.synced ? parseLrc(online.synced) : plainToLines(online.plain!)
  if (lines.length === 0) return []

  writeCache(track.id, lines)
  saveCloud(track, online)
  return lines
}
