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

/**
 * 从 Raw Track 数据（含有 name 字段）解析为标准的 Track 对象。
 *
 * Worker 的 /list 返回的是 `{id, name, url, type, album}` ——
 * **没有 title / artist / folder**，必须过这一层才有。
 * 所以导出给 playlist store 复用：store 直接吃 /list 原始对象的话，
 * 歌名歌手全是 undefined（歌照放，因为播放只用 url），列表和底栏会一片空白。
 */
export function normalizeTrack(raw: {
  name?: string
  url: string
  type?: string
  album?: string
  duration?: number
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
    // mp3 走原生播放，hls 交给 hls.js —— APlayer 按 URL 自己判断，这里只做标记
    type: raw.type === 'mp3' || /\.mp3$/i.test(raw.url) ? 'mp3' : 'hls',
    ...(raw.duration ? { duration: raw.duration } : {})
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

/** 从一份曲目列表里提取艺人（去重，按曲目数降序） */
function buildArtists(tracks: Track[]): Artist[] {
  const artistMap = new Map<string, Track[]>()
  for (const track of tracks) {
    const list = artistMap.get(track.artist) || []
    list.push(track)
    artistMap.set(track.artist, list)
  }
  return Array.from(artistMap.entries())
    .map(([name, artistTracks]) => ({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      trackCount: artistTracks.length,
      albums: []
    }))
    .sort((a, b) => b.trackCount - a.trackCount)
}

/**
 * 获取艺人列表（前端本地构建）
 */
export async function fetchArtists(): Promise<Artist[]> {
  return buildArtists(await fetchAllTracks())
}

/**
 * 获取艺人详情
 *
 * 只抓一次 /list：原来 fetchArtists() + fetchAllTracks() 各抓一遍，
 * 打开一个艺人页要下两遍 60KB 的曲库。
 */
export async function fetchArtistDetail(id: string): Promise<ArtistDetailResponse | null> {
  const tracks = await fetchAllTracks()
  const artist = buildArtists(tracks).find((a) => a.id === id)
  if (!artist) return null

  return {
    artist: { ...artist, albums: [] },
    tracks: tracks.filter((t) => t.artist === artist.name)
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
