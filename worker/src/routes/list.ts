import { json, error, normalizeTrack } from '../utils/response'
import type { Env } from '../utils/types'

/** GET /list — 获取全部曲目列表 */
export async function handleList(_request: Request, env: Env): Promise<Response> {
  try {
    const object = await env.MUSIC.get('playlist.json')
    if (!object) {
      return error('Playlist Not Found', 404)
    }

    const rawData = await object.json<any[]>()
    const tracks = rawData
      .map(normalizeTrack)
      .filter(Boolean)

    return json(tracks)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return error(`Failed to load playlist: ${message}`)
  }
}
