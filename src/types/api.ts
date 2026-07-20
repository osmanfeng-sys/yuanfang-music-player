import type { Track, Artist } from './music'

/** Worker API 通用响应 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/** GET /list 响应（即 Track[] 本身，保留别名便于扩展） */
export type PlaylistResponse = Track[]

/** GET /api/artists 响应 */
export interface ArtistsResponse {
  artists: Artist[]
}

/** GET /api/artist/:id 响应 */
export interface ArtistDetailResponse {
  artist: Artist
  tracks: Track[]
}

/** POST /api/playlists 请求体 */
export interface CreatePlaylistRequest {
  name: string
  description?: string
  trackIds: string[]
}

/** PUT /api/playlists/:id 请求体 */
export interface UpdatePlaylistRequest {
  name?: string
  description?: string
  trackIds?: string[]
}

/** 分页参数（通用） */
export interface PaginationParams {
  limit?: number
  offset?: number
}

/** 搜索参数 */
export interface SearchParams {
  q: string
}

/** 通用分页响应 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  limit: number
  offset: number
}
