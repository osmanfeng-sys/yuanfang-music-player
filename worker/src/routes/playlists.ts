import { json, error, noContent } from '../utils/response'
import { getJSON, putJSON } from '../utils/r2'
import type { Env, Playlist } from '../utils/types'

/** 播放列表存储的 R2 key 前缀 */
const PLAYLIST_PREFIX = 'user-playlists'

/**
 * 用户 key 的格式校验。
 *
 * key 由前端 `sha256("<ID>:<密码>")` 转 base64url 后取前 22 位得来，
 * 字符集只有 `A-Za-z0-9_-` —— **天然路径安全**，所以这里只需一道格式正则，
 * 不用再做 `../` 之类的穿越过滤（非法字符根本进不来）。
 */
const USER_KEY_RE = /^[A-Za-z0-9_-]{22}$/

/** 请求体限额：现在没有账号体系，写入面是敞开的，必须挡住超大对象 */
const MAX_NAME = 60
const MAX_DESC = 200
const MAX_TRACKS = 500

/** 从请求头取用户 key；缺失或格式非法返回 null（调用方一律回 401） */
function userKeyOf(request: Request): string | null {
  const key = request.headers.get('X-User-Key')
  return key && USER_KEY_RE.test(key) ? key : null
}

/** 每个用户一份索引：user-playlists/<key>/index.json */
function indexKey(uid: string): string {
  return `${PLAYLIST_PREFIX}/${uid}/index.json`
}

/** 首次到场记录：user-playlists/<key>/seen.json */
function seenKey(uid: string): string {
  return `${PLAYLIST_PREFIX}/${uid}/seen.json`
}

/** 展示用 ID 的长度上限（够放中文 ID 了） */
const MAX_ID_LEN = 40

/**
 * 取请求头里的「展示用 ID」—— 前端把用户 ID 原文带过来，**仅用于后台看谁在用**。
 *
 * ⚠️ 这个头**完全不可信**：这套接口没有任何鉴权，谁都能伪造它；
 *    而且真正的身份是 X-User-Key（不可逆哈希），这个 ID 不参与任何判断。
 *    所以写入前必须限长 + 去掉控制字符 —— 否则有人能塞进超大字符串，
 *    或用换行污染 list-users.mjs 的输出。
 */
function userIdOf(request: Request): string {
  const raw = request.headers.get('X-User-Id') ?? ''
  let id = raw
  try {
    id = decodeURIComponent(raw)
  } catch {
    // 不是合法的百分号编码就按原样用（前端是用 encodeURIComponent 发的）
  }
  return id.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, MAX_ID_LEN)
}

/**
 * 首次到场记一笔。
 *
 * 为什么需要：GET 本来是纯读，登录/读取在服务端不留任何痕迹，
 * 于是「有多少人在用」完全问不出来。这里只在 seen.json **不存在**时写一次 ——
 * 写入次数 = 每个用户一次，可以忽略。
 *
 * 刻意不记 lastSeen：那要每次请求都读+写，"谁来过"这个需求不需要。
 *
 * 失败**不能影响主流程** —— 记不上就算了，不能让歌单因此读不出来。
 */
async function touchUser(env: Env, uid: string, request: Request): Promise<void> {
  try {
    const key = seenKey(uid)
    const head = await env.MUSIC.head(key)
    if (head) return
    await putJSON(env, key, {
      firstSeen: new Date().toISOString(),
      id: userIdOf(request)
    })
  } catch {
    // 静默：这只是统计，不该让主流程失败
  }
}

/**
 * 读取该用户的全部歌单。
 *
 * ⚠️ 这是「整份读、整份写」的模型，同一用户多标签页并发写仍会后写覆盖先写
 *（R2 没有 CAS）。按用户分片只是把冲突面从「所有用户」缩到「同一用户」，
 * 对当前规模够用；将来要更稳得改成一个歌单一个对象。
 */
async function getAllPlaylists(env: Env, uid: string): Promise<Playlist[]> {
  return (await getJSON<Playlist[]>(env, indexKey(uid))) ?? []
}

/** 保存该用户的全部歌单 */
async function saveAllPlaylists(env: Env, uid: string, playlists: Playlist[]): Promise<boolean> {
  return putJSON(env, indexKey(uid), playlists)
}

/** 校验请求体，返回错误信息；合法返回 null */
function validateBody(body: {
  name?: string
  description?: string
  trackIds?: string[]
}): string | null {
  if (body.name !== undefined && body.name.length > MAX_NAME) {
    return `Name too long (max ${MAX_NAME})`
  }
  if (body.description !== undefined && body.description.length > MAX_DESC) {
    return `Description too long (max ${MAX_DESC})`
  }
  if (body.trackIds !== undefined && body.trackIds.length > MAX_TRACKS) {
    return `Too many tracks (max ${MAX_TRACKS})`
  }
  return null
}

/** GET /api/playlists — 获取当前用户的播放列表 */
export async function handleGetPlaylists(request: Request, env: Env): Promise<Response> {
  const uid = userKeyOf(request)
  if (!uid) return error('Unauthorized', 401)

  // 「登录」的信号就打在这里：前端一进首页、只要配了凭据就会拉一次歌单。
  // 放在这个分支而不是 POST/PUT/DELETE —— 那些是"改歌单"，不是"到场"。
  await touchUser(env, uid, request)

  return json(await getAllPlaylists(env, uid))
}

/** GET /api/playlists/:id — 获取当前用户的单个播放列表 */
export async function handleGetPlaylist(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  const uid = userKeyOf(request)
  if (!uid) return error('Unauthorized', 401)

  const playlists = await getAllPlaylists(env, uid)
  const playlist = playlists.find((p) => p.id === id)
  if (!playlist) return error('Playlist not found', 404)
  return json(playlist)
}

/** POST /api/playlists — 创建播放列表 */
export async function handleCreatePlaylist(request: Request, env: Env): Promise<Response> {
  const uid = userKeyOf(request)
  if (!uid) return error('Unauthorized', 401)

  try {
    const body: { name?: string; description?: string; trackIds?: string[] } =
      await request.json()

    if (!body.name?.trim()) {
      return error('Name is required', 400)
    }
    const invalid = validateBody(body)
    if (invalid) return error(invalid, 400)

    const now = new Date().toISOString()
    const newPlaylist: Playlist = {
      id: crypto.randomUUID(),
      name: body.name.trim(),
      description: body.description,
      trackIds: body.trackIds ?? [],
      createdAt: now,
      updatedAt: now,
      // 前端 store 的 userPlaylists 是按 source === 'user' 过滤的；
      // 不下发这个字段的话，从云端取回的歌单会整个不进列表
      source: 'user'
    }

    const playlists = await getAllPlaylists(env, uid)
    playlists.push(newPlaylist)
    await saveAllPlaylists(env, uid, playlists)

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
  const uid = userKeyOf(request)
  if (!uid) return error('Unauthorized', 401)

  try {
    const body: { name?: string; description?: string; trackIds?: string[] } =
      await request.json()

    const invalid = validateBody(body)
    if (invalid) return error(invalid, 400)

    const playlists = await getAllPlaylists(env, uid)
    const index = playlists.findIndex((p) => p.id === id)
    if (index === -1) return error('Playlist not found', 404)

    const updated = playlists[index]
    if (body.name !== undefined) updated.name = body.name.trim()
    if (body.description !== undefined) updated.description = body.description
    if (body.trackIds !== undefined) updated.trackIds = body.trackIds
    updated.updatedAt = new Date().toISOString()

    playlists[index] = updated
    await saveAllPlaylists(env, uid, playlists)

    return json(updated)
  } catch {
    return error('Invalid request body', 400)
  }
}

/** DELETE /api/playlists/:id — 删除播放列表 */
export async function handleDeletePlaylist(
  request: Request,
  env: Env,
  id: string
): Promise<Response> {
  const uid = userKeyOf(request)
  if (!uid) return error('Unauthorized', 401)

  const playlists = await getAllPlaylists(env, uid)
  const index = playlists.findIndex((p) => p.id === id)
  if (index === -1) return error('Playlist not found', 404)

  playlists.splice(index, 1)
  await saveAllPlaylists(env, uid, playlists)

  return noContent()
}
