import { json, error } from '../utils/response'
import { getJSON, putJSON } from '../utils/r2'
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

/** GET /api/lyrics/:key — 读取云端歌词 */
export async function handleGetLyrics(
  _request: Request,
  env: Env,
  key: string
): Promise<Response> {
  const data = await getJSON<LyricRecord>(env, `${LYRICS_PREFIX}/${key}.json`)
  if (!data) return error('Lyrics not found', 404)
  return json(data)
}

/** PUT /api/lyrics/:key — 保存歌词到云端 */
export async function handlePutLyrics(
  request: Request,
  env: Env,
  key: string
): Promise<Response> {
  try {
    const body = (await request.json()) as Partial<LyricRecord>
    if (!body?.synced && !body?.plain) return error('Empty lyrics', 400)

    const record: LyricRecord = {
      id: key,
      source: body.source ?? 'unknown',
      synced: body.synced,
      plain: body.plain,
      artist: body.artist,
      title: body.title,
      savedAt: new Date().toISOString()
    }

    const ok = await putJSON(env, `${LYRICS_PREFIX}/${key}.json`, record)
    if (!ok) return error('Save failed', 500)
    return json(record)
  } catch {
    return error('Invalid request body', 400)
  }
}
