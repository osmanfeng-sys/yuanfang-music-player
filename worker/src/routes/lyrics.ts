import { json, error } from '../utils/response'
import { getJSON } from '../utils/r2'
import type { Env } from '../utils/types'

/** 歌词存储的 R2 key 前缀 */
const LYRICS_PREFIX = 'lyrics'

/** 云端歌词记录 */
export interface LyricRecord {
  /** 曲目 ID（前端生成的 slug） */
  id: string
  /** 歌词来源，如 lrclib */
  source: string
  /** 带时间轴的 LRC 文本 */
  synced?: string
  /** 纯文本歌词（无时间轴时兜底） */
  plain?: string
  /** 曲目原始信息，便于人工核对 */
  artist?: string
  title?: string
  /** 保存时间 */
  savedAt: string
}

/**
 * GET /api/lyrics/:key — 读取云端歌词（公开，只读）
 *
 * 没有对应的写入接口：歌词只由 `upload-lyrics.mjs` 在本机用 R2 S3 密钥直写，
 * 因此任何人通过网页都写不进来（前端也已移除云端写入）。
 */
export async function handleGetLyrics(
  _request: Request,
  env: Env,
  key: string
): Promise<Response> {
  const data = await getJSON<LyricRecord>(env, `${LYRICS_PREFIX}/${key}.json`)
  if (!data) return error('Lyrics not found', 404)
  return json(data)
}
