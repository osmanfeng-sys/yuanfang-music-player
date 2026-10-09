import { get } from './api'
import { WORKER_BASE_URL } from '@/utils/constants'
import type { Track, Artist, ArtistDetailResponse } from '@/types'
import { parseTrackName, generateTrackId } from '@/utils/parser'

/** 从媒资 URL 解析音乐夹名（R2 一级目录，如 "01_AQUA(水叮当)"） */
function extractFolder(url: string): string | undefined {
  try {
    const seg = decodeURIComponent(new URL(url).pathname).split('/').filter(Boolean)[0]
    return seg || undefined
  } catch {
    return undefined
  }
}

/** 从 Raw Track 数据（含有 name 字段）解析为标准的 Track 对象 */
function normalizeTrack(raw: {
  name?: string
  url: string
  type: string
  album?: string
}): Track | null {
  const name = raw.name
  if (!name) return null

  const { artist, title } = parseTrackName(name)
  // ID 对原始 name 取哈希：解析会剥掉 "[mqms2]" 等后缀，据此算 ID 会撞车
  const id = generateTrackId(name)

  return {
    id,
    title,
    artist,
    url: raw.url,
    // album 由 Worker 下发（R2 一级目录派生），未部署新版 Worker 时前端兜底
    album: raw.album || extractFolder(raw.url)?.replace(/^\d+[_-]/, ''),
    folder: extractFolder(raw.url),
    type: 'hls'
  }
}

/** 从 Worker API URL 构造完整媒资 URL */
export function getMediaUrl(path: string): string {
  return `${WORKER_BASE_URL}/${encodeURIComponent(path)}`
}

/**
 * 获取全部曲目（GET /list → Track[]）
 *
 * 当前 Worker 返回的是含有 `name` 字段的原始数组，
 * 需要经过 normalizeTrack 转换为标准 Track 格式。
 */
export async function fetchAllTracks(): Promise<Track[]> {
  const res = await get<unknown[]>('/list')

  if (!res.success || !res.data) {
    console.error('[music] 获取曲目列表失败:', res.error)
    return []
  }

  return res.data
    .map((item: any) => normalizeTrack(item))
    .filter((t): t is Track => t !== null)
}

/**
 * 获取艺人列表（从所有曲目中提取、去重）
 * Worker 目前没有 /api/artists 端点，先本机构建
 */
export async function fetchArtists(): Promise<Artist[]> {
  const tracks = await fetchAllTracks()

  const artistMap = new Map<string, Track[]>()
  for (const track of tracks) {
    const list = artistMap.get(track.artist) || []
    list.push(track)
    artistMap.set(track.artist, list)
  }

  return Array.from(artistMap.entries()).map(([name, artistTracks]) => ({
    id: name.toLowerCase().replace(/\s+/g, '-'),
    name,
    trackCount: artistTracks.length,
    albums: [] // 后续 Phase 从路径推断专辑
  }))
}

/**
 * 获取艺人详情
 */
export async function fetchArtistDetail(id: string): Promise<ArtistDetailResponse | null> {
  const artists = await fetchArtists()
  const artist = artists.find((a) => a.id === id)
  if (!artist) return null

  const tracks = await fetchAllTracks()
  const artistTracks = tracks.filter((t) => t.artist === artist.name)

  return {
    artist: {
      ...artist,
      albums: [] // 后续 Phase 实现专辑推断
    },
    tracks: artistTracks
  }
}

/**
 * 搜索曲目（前端本地搜索）
 */
export async function searchTracks(query: string): Promise<Track[]> {
  if (!query.trim()) return []
  const tracks = await fetchAllTracks()
  const q = query.toLowerCase()
  return tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q)
  )
}
