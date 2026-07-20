// ========== 音乐文件相关 ==========

/** HLS 音轨 */
export interface Track {
  /** 唯一标识，格式: "artist_album_trackname" 的 hash 或 slug */
  id: string
  /** 歌曲名，如 "Barbie Girl" */
  title: string
  /** 艺人名，如 "Aqua" */
  artist: string
  /** 专辑名（可选，从路径推断） */
  album?: string
  /** R2 中 playlist.m3u8 的完整 Worker URL */
  url: string
  /** 封面图 URL（可选） */
  cover?: string
  /** 歌词文件 URL（可选） */
  lyricsUrl?: string
  /** 时长（秒），初始未知，播放后获取 */
  duration?: number
  /** 媒体类型 */
  type: 'hls'
}

/** 艺人 */
export interface Artist {
  /** 唯一标识 */
  id: string
  /** 艺人名 */
  name: string
  /** 艺人名（中文/日文/其他语言） */
  nameLocalized?: string
  /** 封面图 */
  cover?: string
  /** 该艺人的歌曲数量 */
  trackCount: number
  /** 该艺人的专辑列表 */
  albums: Album[]
}

/** 专辑 */
export interface Album {
  /** 唯一标识 */
  id: string
  /** 专辑名 */
  name: string
  /** 所属艺人 ID */
  artistId: string
  /** 封面图 */
  cover?: string
  /** 发行年份 */
  year?: number
  /** 曲目列表 */
  tracks: Track[]
}

/** 已解析的 Track 名称（Artist - Title 格式） */
export interface ParsedTrackName {
  artist: string
  title: string
}
