import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { WORKER_BASE_URL } from '@/utils/constants'
import { normalizeTrack } from '@/services/music'
import { parseM3u8Duration } from '@/services/prefetch'
import { loadCredentials } from '@/utils/userKey'
import { loadJSON, saveJSON } from '@/utils/localStore'
import {
  createPlaylist as apiCreatePlaylist,
  updatePlaylist as apiUpdatePlaylist,
  deletePlaylist as apiDeletePlaylist,
  fetchUserPlaylists
} from '@/services/playlist'
import type { Track, Artist, Playlist } from '@/types'

export const usePlaylistStore = defineStore('playlist', () => {
  // ===== State =====
  // 使用 Record 而非 Map 以获得更好的 devtools 兼容性

  /** 所有播放列表（系统 + 用户） */
  const playlists = ref<Record<string, Playlist>>({})
  /** 所有音轨缓存（避免重复请求） */
  const trackCache = ref<Record<string, Track>>({})
  /** 艺人列表缓存 */
  const artistCache = ref<Artist[]>([])
  /** 加载状态 */
  const loading = ref(false)
  /** 错误信息 */
  const error = ref<string | null>(null)

  /**
   * **云端写入失败过**的歌单 id。
   *
   * 为什么需要它：歌单的每次改动都是「立即写云端」，正常情况下不存在"待保存"。
   * 真正的"没保存上"只发生在写入失败时 —— 而失败以前只是弹一条 error 就过去了，
   * 用户看到列表里歌还在（本地 state 已改），完全不知道云端其实没落。
   * 这个集合就是给「同步」按钮的橙/绿状态用的。
   */
  const unsyncedIds = ref<string[]>([])

  function markUnsynced(id: string, unsynced: boolean) {
    unsyncedIds.value = unsynced
      ? Array.from(new Set([...unsyncedIds.value, id]))
      : unsyncedIds.value.filter((x) => x !== id)
  }

  // ===== Getters =====

  const systemPlaylists = computed(() =>
    Object.values(playlists.value).filter((p) => p.source === 'system')
  )

  const userPlaylists = computed(() =>
    Object.values(playlists.value).filter((p) => p.source === 'user')
  )

  const allTracks = computed(() => Object.values(trackCache.value))

  /** 音乐夹分组（按 R2 一级目录名），每夹内含其全部曲目 */
  const folders = computed(() => {
    const map = new Map<string, Track[]>()
    for (const t of Object.values(trackCache.value)) {
      const name = t.folder ?? '未分类'
      const list = map.get(name)
      if (list) list.push(t)
      else map.set(name, [t])
    }
    return Array.from(map, ([name, tracks]) => ({ name, tracks })).sort((a, b) =>
      a.name.localeCompare(b.name, 'zh-Hans-CN')
    )
  })

  /** 艺人分组（按曲目数降序），首页用它挑默认歌单 */
  const artists = computed(() => {
    const map = new Map<string, Track[]>()
    for (const t of Object.values(trackCache.value)) {
      const list = map.get(t.artist)
      if (list) list.push(t)
      else map.set(t.artist, [t])
    }
    return Array.from(map, ([name, tracks]) => ({ name, tracks })).sort(
      (a, b) => b.tracks.length - a.tracks.length
    )
  })

  function getPlaylistById(id: string): Playlist | undefined {
    return playlists.value[id]
  }

  function getTrackById(id: string): Track | undefined {
    return trackCache.value[id]
  }

  /** 获取指定艺人的曲目列表 */
  function getTracksByArtist(artistId: string): Track[] {
    return Object.values(trackCache.value).filter(
      (t) => t.artist === artistId
    )
  }

  /** 获取艺人名对应的系统播放列表（如"郑源精选"） */
  function getPlaylistByArtist(artistName: string): Playlist | null {
    const tracks = Object.values(trackCache.value).filter(
      (t) => t.artist === artistName
    )
    if (tracks.length === 0) return null
    const id = `artist_${artistName}`
    return {
      id,
      name: `${artistName}精选`,
      description: `${artistName}的全部歌曲，共 ${tracks.length} 首`,
      trackIds: tracks.map((t) => t.id),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'system'
    }
  }

  /** 本地搜索曲目（按标题或艺人名） */
  function searchTracks(query: string): Track[] {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return Object.values(trackCache.value).filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.artist.toLowerCase().includes(q)
    )
  }

  // ===== Actions =====

  /** 从 Worker 加载播放列表和曲目 */
  async function fetchPlaylists(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await fetch(`${WORKER_BASE_URL}/list`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const raw = (await res.json()) as { name?: string; url: string; type: string }[]

      // /list 给的是 {name, url, type, album} 原始对象，没有 title/artist/folder，
      // 必须过 normalizeTrack —— 直接当 Track 用的话歌名歌手全是 undefined，
      // 表现为「歌能放，但列表和底栏一片空白」
      // R2 里存在重复上传（例："Aqua - Aquarius [mqms2]" 与 "Aqua - Aquarius"），
      // 解析后歌手与歌名完全一致，列表会出现两行一模一样的曲目 —— 按 歌手|歌名 去重
      const seen = new Set<string>()
      const tracks = raw
        .map((item) => normalizeTrack(item))
        .filter((t): t is Track => t !== null)
        .filter((t) => {
          const key = `${t.artist}|${t.title}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })

      // 填入 trackCache
      const cache: Record<string, Track> = {}
      for (const track of tracks) {
        cache[track.id] = track
      }
      trackCache.value = cache

      // 构建系统播放列表（所有曲目）
      const playlistId = 'all'
      playlists.value[playlistId] = {
        id: playlistId,
        name: '全部音乐',
        description: '所有可用曲目',
        trackIds: tracks.map((t) => t.id).filter(Boolean),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'system'
      }
    } catch (e) {
      // 网络失败时 e.message 只有 "Failed to fetch"，补一句能落地的提示
      error.value = e instanceof Error ? `加载曲库失败：${e.message}（网络不稳，可重试）` : '加载曲库失败，请重试'
    } finally {
      loading.value = false
    }
  }

  /**
   * 后台补齐曲目时长。
   *
   * /list 不下发 duration，R2 里也没有时长元数据，唯一来源是每首曲子的 m3u8
   * （约 748 B 的小文件），把 `#EXTINF` 累加即得。
   * 并发压到 2，并由调用方延迟启动 —— 别和正在播放的分片抢带宽。
   */
  async function fillDurations(tracks: Track[], concurrency = 2): Promise<void> {
    // mp3 的时长由索引（durations.json）下发，m3u8 才有 #EXTINF 可解析
    const pending = tracks.filter((t) => t.duration == null && t.type === 'hls')
    const worker = async () => {
      for (;;) {
        const t = pending.shift()
        if (!t) return
        try {
          const res = await fetch(t.url)
          if (!res.ok) continue
          const seconds = parseM3u8Duration(await res.text())
          if (seconds > 0 && trackCache.value[t.id]) {
            trackCache.value[t.id] = {
              ...trackCache.value[t.id],
              duration: Math.round(seconds)
            }
          }
        } catch {
          // 单首失败不影响其余
        }
      }
    }
    await Promise.all(Array.from({ length: concurrency }, () => worker()))
  }

  /** 获取单个曲目详情 */
  async function fetchTrack(trackId: string): Promise<Track | undefined> {
    if (trackCache.value[trackId]) return trackCache.value[trackId]
    // 可以从 Worker 按 ID 获取，暂未实现 API 端点时返回 undefined
    return undefined
  }

  // ===== 用户歌单：本机 / 云端分派 =====
  //
  // 没设置「歌单同步」凭据时走 localStorage —— 功能照常可用，只是只在本机。
  // 设置凭据后走 Worker（按 X-User-Key 隔离）。
  //
  // ⚠️ **不做双向同步、不做冲突合并**：有凭据就以云端为准。
  //    **唯一的例外**是「首次登录」——见 loadUserPlaylists() 里的迁移：
  //    云端还是空的、而本机有歌单时，把本机那份一次性搬上去。
  //    不加这一步的话，先在本机建歌单、之后才登录的人会觉得歌单丢了。

  /** localStorage 的 key（实际会带 `ym:` 前缀） */
  const USER_PLAYLISTS_KEY = 'userPlaylists'

  /** 是否已配置云端凭据 */
  function hasCloud(): boolean {
    return loadCredentials() !== null
  }

  /** 把当前用户歌单写回 localStorage */
  function persistLocal(): void {
    saveJSON(USER_PLAYLISTS_KEY, userPlaylists.value)
  }

  /**
   * 载入用户歌单（云端或本机）。已存在的条目按 id 覆盖。
   *
   * 云端模式下**失败必须与「空」区分开**：fetchUserPlaylists 返回 null 表示
   * 请求失败（含密码打错被 401），此时保持界面上原有的歌单不动 —— 否则
   * 用户会看到歌单凭空消失，还会以为数据丢了。
   */
  async function loadUserPlaylists(): Promise<void> {
    if (hasCloud()) {
      const remote = await fetchUserPlaylists()
      if (remote === null) {
        error.value =
          '云端歌单读取失败：接口不可达或 ID/密码不对。' +
          '（可在顶栏人像菜单里退出登录，改用本机模式）'
        return
      }

      // ─── 首次登录：把本机那份搬到云端 ───
      //
      // 场景：用户先在本机建了歌单，之后才在设置里填 ID/密码。
      // 「有凭据就以云端为准」会把那些本机歌单**直接看不到**（不是删除，
      // 只是被云端数据取代了），看起来就像丢了。
      //
      // 只在「云端是空的 且 本机有东西」时做一次；之后一律以云端为准 ——
      // 仍然不做双向同步、不做冲突合并。
      const local = loadJSON<Playlist[]>(USER_PLAYLISTS_KEY, [])
      if (remote.length === 0 && local.length > 0) {
        const migrated = await migrateLocalToCloud(local)
        if (migrated === null) {
          // 没搬成功就【显示本机那份】，别让用户觉得歌单没了。
          // 本机缓存不清，下次进来云端仍是空的，会自动再试一次。
          error.value = '本机歌单上传到云端失败，暂时先显示本机这份，下次会自动重试'
          for (const p of local) playlists.value[p.id] = { ...p, source: 'user' }
          return
        }
        // 搬完了：清掉本机那份，避免以后被重复当成"待上传"
        saveJSON(USER_PLAYLISTS_KEY, [])
        remote.push(...migrated)
      }

      for (const p of remote) {
        // 补 source：早期写入的对象没有这个字段，而 userPlaylists 是按它过滤的
        playlists.value[p.id] = { ...p, source: 'user' }
      }
      return
    }

    for (const p of loadJSON<Playlist[]>(USER_PLAYLISTS_KEY, [])) {
      playlists.value[p.id] = { ...p, source: 'user' }
    }
  }

  /**
   * 把本机歌单逐条创建到云端，返回云端分配的新歌单；**任一条失败就返回 null**。
   *
   * ⚠️ id 会变：本机 id 是 `playlist_<时间戳>_<随机>`，云端由 Worker 生成 uuid。
   *    这是有意的 —— 让云端做 id 的唯一来源，不做 id 映射（没有别的地方引用它）。
   * 全成功才返回，是为了让调用方能用"清本机缓存"作为"迁移完成"的标记；
   * 部分成功会让本机剩下的那些永远搬不过去。
   */
  async function migrateLocalToCloud(local: Playlist[]): Promise<Playlist[] | null> {
    const created: Playlist[] = []
    for (const p of local) {
      // CreatePlaylistRequest 的 trackIds 必填，description 不接受显式 undefined
      const c = await apiCreatePlaylist({
        name: p.name,
        trackIds: p.trackIds ?? [],
        ...(p.description ? { description: p.description } : {})
      })
      if (!c) return null
      created.push(c)
    }
    return created
  }

  /** 创建歌单。云端模式先落云端拿到稳定 id，再写本地 state */
  async function createPlaylist(name: string, description?: string): Promise<Playlist | null> {
    const trimmed = name.trim()
    if (!trimmed) return null

    if (hasCloud()) {
      // CreatePlaylistRequest 的 trackIds 是必填，description 不接受显式 undefined
      const created = await apiCreatePlaylist({
        name: trimmed,
        trackIds: [],
        ...(description ? { description } : {})
      })
      if (!created) {
        error.value =
          '云端创建失败：接口不可达或凭据失效。' +
          '（可在顶栏人像菜单里退出登录，改用本机模式）'
        return null
      }
      playlists.value[created.id] = { ...created, source: 'user' }
      markUnsynced(created.id, false)
      return playlists.value[created.id]
    }

    const now = new Date().toISOString()
    const id = `playlist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const playlist: Playlist = {
      id,
      name: trimmed,
      description,
      trackIds: [],
      createdAt: now,
      updatedAt: now,
      source: 'user'
    }
    playlists.value[id] = playlist
    persistLocal()
    return playlist
  }

  /**
   * 更新歌单。本地先改让 UI 立刻响应；云端失败只置 error、**不回滚** ——
   * 回滚会制造中间态，而下次 loadUserPlaylists() 本来就会以云端为准覆盖。
   */
  async function updatePlaylist(
    id: string,
    data: Partial<Pick<Playlist, 'name' | 'description' | 'trackIds'>>
  ): Promise<void> {
    const p = playlists.value[id]
    if (!p) return

    if (data.name !== undefined) p.name = data.name
    if (data.description !== undefined) p.description = data.description
    if (data.trackIds !== undefined) p.trackIds = data.trackIds
    p.updatedAt = new Date().toISOString()

    if (hasCloud()) {
      const ok = await apiUpdatePlaylist(id, data)
      markUnsynced(id, !ok)
      if (!ok) error.value = '云端保存失败'
    } else {
      persistLocal()
    }
  }

  /**
   * 把某个歌单的当前内容重新推给云端 —— 给「同步」按钮用。
   * 只在该歌单写入失败过（在 unsyncedIds 里）时才需要调用。
   */
  async function syncPlaylist(id: string): Promise<boolean> {
    const p = playlists.value[id]
    if (!p || !hasCloud()) return false

    const ok = await apiUpdatePlaylist(id, {
      name: p.name,
      trackIds: p.trackIds,
      ...(p.description ? { description: p.description } : {})
    })
    markUnsynced(id, !ok)
    error.value = ok ? null : '同步失败，稍后再试'
    return ok
  }

  async function deletePlaylist(id: string): Promise<void> {
    const p = playlists.value[id]
    if (!p) return
    delete playlists.value[id]

    if (hasCloud()) {
      const ok = await apiDeletePlaylist(id)
      if (!ok) {
        // 云端没删掉就加回来 —— 否则刷新后它又出现，看着像删除没生效
        playlists.value[id] = p
        error.value = '云端删除失败'
      }
    } else {
      persistLocal()
    }
  }

  /** 加曲目（已在歌单里则忽略） */
  async function addToPlaylist(playlistId: string, trackId: string): Promise<void> {
    const p = playlists.value[playlistId]
    if (!p || p.trackIds.includes(trackId)) return
    await updatePlaylist(playlistId, { trackIds: [...p.trackIds, trackId] })
  }

  async function removeFromPlaylist(playlistId: string, trackId: string): Promise<void> {
    const p = playlists.value[playlistId]
    if (!p) return
    await updatePlaylist(playlistId, { trackIds: p.trackIds.filter((t) => t !== trackId) })
  }

  return {
    // State
    playlists,
    trackCache,
    artistCache,
    loading,
    error,
    // Getters
    systemPlaylists,
    userPlaylists,
    allTracks,
    folders,
    artists,
    getPlaylistById,
    getTrackById,
    getTracksByArtist,
    getPlaylistByArtist,
    searchTracks,
    // Actions
    fetchPlaylists,
    fillDurations,
    fetchTrack,
    loadUserPlaylists,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist,
    unsyncedIds,
    syncPlaylist
  }
})
