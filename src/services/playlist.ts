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
 * 获取用户播放列表列表
 *
 * 注意：Worker 目前未实现此端点，
 * 在 Phase B 云端存储实施之前返回空数组。
 */
export async function fetchUserPlaylists(): Promise<Playlist[]> {
  const res = await get<Playlist[]>('/api/playlists')
  if (!res.success || !res.data) {
    return []
  }
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
