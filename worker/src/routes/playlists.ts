import { json, error, noContent } from '../utils/response'
import { getJSON, putJSON, deleteKey } from '../utils/r2'
import type { Env, Playlist } from '../utils/types'

/** 播放列表存储的 R2 key 前缀 */
const PLAYLIST_PREFIX = 'user-playlists'

/** 生成唯一 ID */
function generateId(): string {
  return `pl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

/** 获取所有用户播放列表 */
async function getAllPlaylists(env: Env): Promise<Playlist[]> {
  return (await getJSON<Playlist[]>(env, `${PLAYLIST_PREFIX}/index.json`)) ?? []
}

/** 保存所有用户播放列表 */
async function saveAllPlaylists(env: Env, playlists: Playlist[]): Promise<boolean> {
  return putJSON(env, `${PLAYLIST_PREFIX}/index.json`, playlists)
}

/** GET /api/playlists — 获取用户播放列表 */
export async function handleGetPlaylists(_request: Request, env: Env): Promise<Response> {
  const playlists = await getAllPlaylists(env)
  return json(playlists)
}

/** GET /api/playlists/:id — 获取单个播放列表 */
export async function handleGetPlaylist(
  _request: Request,
  env: Env,
  id: string
): Promise<Response> {
  const playlists = await getAllPlaylists(env)
  const playlist = playlists.find((p) => p.id === id)
  if (!playlist) return error('Playlist not found', 404)
  return json(playlist)
}

/** POST /api/playlists — 创建播放列表 */
export async function handleCreatePlaylist(request: Request, env: Env): Promise<Response> {
  try {
    const body: { name?: string; description?: string; trackIds?: string[] } =
      await request.json()

    if (!body.name?.trim()) {
      return error('Name is required', 400)
    }

    const now = new Date().toISOString()
    const newPlaylist: Playlist = {
      id: generateId(),
      name: body.name.trim(),
      description: body.description,
      trackIds: body.trackIds ?? [],
      createdAt: now,
      updatedAt: now
    }

    const playlists = await getAllPlaylists(env)
    playlists.push(newPlaylist)
    await saveAllPlaylists(env, playlists)

    return json(newPlaylist, 201)
  } catch {
    return error('Invalid request body', 400)
  }
}

/** PUT /api/playlists/:id — 更新播放列表 */
export async function handleUpdatePlaylist(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  try {
    const body: { name?: string; description?: string; trackIds?: string[] } =
      await request.json()

    const playlists = await getAllPlaylists(env)
    const index = playlists.findIndex((p) => p.id === id)
    if (index === -1) return error('Playlist not found', 404)

    const updated = playlists[index]
    if (body.name !== undefined) updated.name = body.name.trim()
    if (body.description !== undefined) updated.description = body.description
    if (body.trackIds !== undefined) updated.trackIds = body.trackIds
    updated.updatedAt = new Date().toISOString()

    playlists[index] = updated
    await saveAllPlaylists(env, playlists)

    return json(updated)
  } catch {
    return error('Invalid request body', 400)
  }
}

/** DELETE /api/playlists/:id — 删除播放列表 */
export async function handleDeletePlaylist(
  _request: Request,
  env: Env,
  id: string
): Promise<Response> {
  const playlists = await getAllPlaylists(env)
  const index = playlists.findIndex((p) => p.id === id)
  if (index === -1) return error('Playlist not found', 404)

  playlists.splice(index, 1)
  await saveAllPlaylists(env, playlists)

  return noContent()
}
