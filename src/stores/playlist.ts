import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
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
      const res = await fetch('https://music-proxy.osmanfeng.workers.dev/list')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const tracks: Track[] = await res.json()

      // 填入 trackCache
      const cache: Record<string, Track> = {}
      for (const track of tracks) {
        if (track.id) {
          cache[track.id] = track
        }
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
      error.value = e instanceof Error ? e.message : '获取播放列表失败'
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
    getPlaylistById,
    getTrackById,
    getTracksByArtist,
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
