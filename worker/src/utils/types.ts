/** 音轨（Worker 内部表示，与 R2 JSON 结构对齐） */
export interface Track {
  id: string
  name: string
  url: string
  type: 'hls'
}

/** 艺人 */
export interface Artist {
  id: string
  name: string
  trackCount: number
}

/** 播放列表 */
export interface Playlist {
  id: string
  name: string
  description?: string
  trackIds: string[]
  createdAt: string
  updatedAt: string
}

/** 通用 API 响应 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/** Worker Env（wrangler.toml 绑定） */
export interface Env {
  MUSIC: R2Bucket
}

/** 路由处理器签名 */
export type RouteHandler = (request: Request, env: Env, match: URL) => Response | Promise<Response>
