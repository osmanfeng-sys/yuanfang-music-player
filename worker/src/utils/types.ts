/** 音轨（Worker 内部表示，与 R2 JSON 结构对齐） */
export interface Track {
  id: string
  name: string
  url: string
  /** hls = 老的分片（playlist.m3u8，走 hls.js）；mp3 = 直传的原文件（走原生 Range 流式） */
  type: 'hls' | 'mp3'
  /** 专辑名：取自 R2 一级目录（音乐夹），去掉 "01_" 序号前缀 */
  album?: string
  /** 时长（秒）：mp3 由 upload-music.mjs 写进 durations.json，HLS 没有（前端解析 m3u8 补） */
  duration?: number
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
