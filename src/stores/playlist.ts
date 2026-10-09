import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { WORKER_BASE_URL } from '@/utils/constants'
import { normalizeTrack } from '@/services/music'
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
      const tracks = raw
        .map((item) => normalizeTrack(item))
        .filter((t): t is Track => t !== null)

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

  /** 获取单个曲目详情 */
  async function fetchTrack(trackId: string): Promise<Track | undefined> {
    if (trackCache.value[trackId]) return trackCache.value[trackId]
    // 可以从 Worker 按 ID 获取，暂未实现 API 端点时返回 undefined
    return undefined
  }

  function createPlaylist(name: string, description?: string): Playlist {
    const id = `playlist_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    const now = new Date().toISOString()
    const playlist: Playlist = {
      id,
      name,
      description,
      trackIds: [],
      createdAt: now,
      updatedAt: now,
      source: 'user'
    }
    playlists.value[id] = playlist
    return playlist
  }

  function updatePlaylist(id: string, data: Partial<Pick<Playlist, 'name' | 'description' | 'trackIds'>>) {
    const p = playlists.value[id]
    if (!p) return
    if (data.name !== undefined) p.name = data.name
    if (data.description !== undefined) p.description = data.description
    if (data.trackIds !== undefined) p.trackIds = data.trackIds
    p.updatedAt = new Date().toISOString()
  }

  function deletePlaylist(id: string) {
    delete playlists.value[id]
  }

  function addToPlaylist(playlistId: string, trackId: string) {
    const p = playlists.value[playlistId]
    if (!p || p.trackIds.includes(trackId)) return
    p.trackIds.push(trackId)
    p.updatedAt = new Date().toISOString()
  }

  function removeFromPlaylist(playlistId: string, trackId: string) {
    const p = playlists.value[playlistId]
    if (!p) return
    p.trackIds = p.trackIds.filter((id) => id !== trackId)
    p.updatedAt = new Date().toISOString()
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
    fetchTrack,
    createPlaylist,
    updatePlaylist,
    deletePlaylist,
    addToPlaylist,
    removeFromPlaylist
  }
})
