/** 播放列表 */
export interface Playlist {
  /** UUID */
  id: string
  /** 播放列表名称 */
  name: string
  /** 描述 */
  description?: string
  /** 封面（第一首歌的封面或自定义） */
  cover?: string
  /** 曲目 ID 列表（有序） */
  trackIds: string[]
  /** 创建时间 (ISO 8601) */
  createdAt: string
  /** 更新时间 (ISO 8601) */
  updatedAt: string
  /** 来源: 系统内置 / 用户创建 / 收藏 */
  source: 'system' | 'user' | 'favorite'
}

/** 播放模式 */
export type PlayMode = 'sequential' | 'shuffle' | 'single-repeat' | 'list-repeat'
