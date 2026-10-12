import { get, post, put, del } from './api'
import type { Playlist, CreatePlaylistRequest, UpdatePlaylistRequest } from '@/types'

/**
 * 创建播放列表
 */
export async function createPlaylist(data: CreatePlaylistRequest): Promise<Playlist | null> {
  const res = await post<Playlist>('/api/playlists', data)
  return res.data ?? null
}

/**
 * 获取当前用户的全部歌单。
 *
 * ⚠️ 失败返回 `null`，**不是空数组** —— 这两件事必须分开：
 * 空数组 = 这个身份下确实没有歌单；null = 请求失败 / 没带凭据被 401。
 * 混在一起的话，「密码打错」会表现为「歌单凭空消失」，
 * 调用方还会拿这个空数组去覆盖本地缓存 —— 那是真的丢数据。
 */
export async function fetchUserPlaylists(): Promise<Playlist[] | null> {
  const res = await get<Playlist[]>('/api/playlists')
  if (!res.success || !res.data) return null
  return res.data
}

/**
 * 获取单个播放列表
 */
export async function getPlaylistById(id: string): Promise<Playlist | null> {
  const res = await get<Playlist>(`/api/playlists/${id}`)
  return res.data ?? null
}

/**
 * 更新播放列表
 */
export async function updatePlaylist(
  id: string,
  data: UpdatePlaylistRequest
): Promise<boolean> {
  const res = await put<Playlist>(`/api/playlists/${id}`, data)
  return res.success
}

/**
 * 删除播放列表
 */
export async function deletePlaylist(id: string): Promise<boolean> {
  const res = await del(`/api/playlists/${id}`)
  return res.success
}
