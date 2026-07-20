import { json, error } from '../utils/response'
import { fetchAllTracks } from '../utils/r2'
import type { Env, Track } from '../utils/types'

function parseTrackName(rawName: string): { artist: string } {
  const dashPattern = /^(.+?)\s*-\s+(.+)$/
  const match = rawName.match(dashPattern)
  if (match) {
    return { artist: match[1].trim() }
  }
  return { artist: 'Unknown' }
}

/** 从所有曲目中提取艺人列表 */
function buildArtists(tracks: Track[]) {
  const artistMap = new Map<string, number>()

  for (const track of tracks) {
    const { artist } = parseTrackName(track.name)
    artistMap.set(artist, (artistMap.get(artist) || 0) + 1)
  }

  return Array.from(artistMap.entries())
    .map(([name, count]) => ({
      id: name.toLowerCase().replace(/\s+/g, '-'),
      name,
      trackCount: count
    }))
    .sort((a, b) => b.trackCount - a.trackCount)
}

/** GET /api/artists — 获取艺人列表 */
export async function handleGetArtists(_request: Request, env: Env): Promise<Response> {
  try {
    const tracks = await fetchAllTracks(env)
    const artists = buildArtists(tracks)
    return json({ artists })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return error(`Failed to get artists: ${message}`)
  }
}

/** GET /api/artists/:id — 获取艺人详情 */
export async function handleGetArtistDetail(
  _request: Request,
  env: Env,
  artistId: string
): Promise<Response> {
  try {
    const tracks = await fetchAllTracks(env)
    const artists = buildArtists(tracks)

    const artist = artists.find((a) => a.id === artistId)
    if (!artist) {
      return error('Artist not found', 404)
    }

    const artistTracks = tracks.filter((track) => {
      const { artist: trackArtist } = parseTrackName(track.name)
      return trackArtist === artist.name
    })

    return json({
      artist: { ...artist, albums: [] },
      tracks: artistTracks
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return error(`Failed to get artist detail: ${message}`)
  }
}

/** GET /api/search?q= — 搜索曲目 */
export async function handleSearch(request: Request, env: Env, url: URL): Promise<Response> {
  const query = url.searchParams.get('q')?.toLowerCase() || ''

  if (!query) {
    return json({ results: [] })
  }

  try {
    const tracks = await fetchAllTracks(env)
    const results = tracks.filter((track) =>
      track.name.toLowerCase().includes(query)
    )

    return json({ results })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return error(`Search failed: ${message}`)
  }
}
