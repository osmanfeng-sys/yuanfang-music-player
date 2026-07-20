import type { Track } from './types'

/** R2 bucket 名称（从 wrangler.toml 绑定） */
const BUCKET_NAME = 'MUSIC'

/**
 * 从 R2 读取并解析 JSON 文件
 */
export async function getJSON<T>(env: Env, key: string): Promise<T | null> {
  try {
    const obj = await env.MUSIC.get(key)
    if (!obj) return null
    const text = await obj.text()
    return JSON.parse(text) as T
  } catch {
    return null
  }
}

/**
 * 将对象写入 R2 作为 JSON
 */
export async function putJSON(env: Env, key: string, data: unknown): Promise<boolean> {
  try {
    await env.MUSIC.put(key, JSON.stringify(data))
    return true
  } catch {
    return false
  }
}

/**
 * 从 R2 删除对象
 */
export async function deleteKey(env: Env, key: string): Promise<boolean> {
  try {
    await env.MUSIC.delete(key)
    return true
  } catch {
    return false
  }
}

/**
 * 获取所有曲目列表（从 playlist.json）
 */
export async function fetchAllTracks(env: Env): Promise<Track[]> {
  const data = await getJSON<Track[]>(env, 'playlist.json')
  return data ?? []
}

/**
 * 获取 Content-Type（基于文件扩展名）
 */
export function getContentType(key: string): string {
  if (key.endsWith('.m3u8')) return 'application/vnd.apple.mpegurl'
  if (key.endsWith('.ts')) return 'video/MP2T'
  if (key.endsWith('.mp3')) return 'audio/mpeg'
  if (key.endsWith('.aac')) return 'audio/aac'
  if (key.endsWith('.flac')) return 'audio/flac'
  if (key.endsWith('.json')) return 'application/json'
  if (key.endsWith('.png')) return 'image/png'
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg'
  if (key.endsWith('.svg')) return 'image/svg+xml'
  return 'application/octet-stream'
}

/**
 * Worker 的 Env 类型（由 wrangler.toml 绑定定义）
 */
export interface Env {
  MUSIC: R2Bucket
}

/**
 * 用于 Track 对象的简化定义（与前端共享结构）
 */
export interface Track {
  id: string
  name: string
  url: string
  type: 'hls'
}
