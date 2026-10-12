import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { MAX_HISTORY } from '@/utils/constants'
import { loadJSON, saveJSON } from '@/utils/localStore'

/** 主背景模式：默认壁纸 / 当前封面模糊 / 纯黑 */
export type BgMode = 'wallpaper' | 'cover' | 'black'

interface SavedSession {
  queue: string[]
  currentIndex: number
  currentTime: number
}

export const useUserStore = defineStore('user', () => {
  // ===== State（从 localStorage 加载） =====

  const bgMode = ref<BgMode>(loadJSON<BgMode>('bgMode', 'wallpaper'))
  const playHistory = ref<string[]>(loadJSON<string[]>('history', []))
  const favorites = ref<string[]>(loadJSON<string[]>('favorites', []))
  const favoritePlaylists = ref<string[]>(loadJSON<string[]>('favPlaylists', []))
  const lastSession = ref<SavedSession | null>(loadJSON<SavedSession | null>('session', null))
  const initialized = ref(false)

  // ===== 自动持久化 =====

  watch(bgMode, (v) => saveJSON('bgMode', v))
  watch(playHistory, (v) => saveJSON('history', v))
  watch(favorites, (v) => saveJSON('favorites', v))
  watch(favoritePlaylists, (v) => saveJSON('favPlaylists', v))
  watch(lastSession, (v) => saveJSON('session', v), { deep: true })

  // ===== Getters =====

  /** 最近播放曲目（前 MAX_HISTORY 首） */
  function recentTracks(allTracks: Record<string, { title: string; artist: string }>) {
    return playHistory.value
      .map((id) => allTracks[id])
      .filter(Boolean)
  }

  function isFavorite(trackId: string): boolean {
    return favorites.value.includes(trackId)
  }

  // ===== Actions =====

  /** 从 localStorage 初始化（后续可扩展为更复杂的初始化） */
  function init() {
    initialized.value = true
  }

  function setBgMode(mode: BgMode) {
    bgMode.value = mode
  }

  function addToHistory(trackId: string) {
    // 去重：移除已存在的相同 ID
    playHistory.value = playHistory.value.filter((id) => id !== trackId)
    // 追加到开头
    playHistory.value.unshift(trackId)
    // 限制长度
    if (playHistory.value.length > MAX_HISTORY) {
      playHistory.value = playHistory.value.slice(0, MAX_HISTORY)
    }
  }

  function toggleFavorite(trackId: string) {
    if (isFavorite(trackId)) {
      favorites.value = favorites.value.filter((id) => id !== trackId)
    } else {
      favorites.value.push(trackId)
    }
  }

  function saveSession(queue: string[], currentIndex: number, currentTime: number) {
    lastSession.value = { queue, currentIndex, currentTime }
  }

  function restoreSession(): SavedSession | null {
    return lastSession.value
  }

  function clearHistory() {
    playHistory.value = []
  }

  return {
    // State
    bgMode,
    playHistory,
    favorites,
    favoritePlaylists,
    lastSession,
    initialized,
    // Getters
    recentTracks,
    isFavorite,
    // Actions
    init,
    setBgMode,
    addToHistory,
    toggleFavorite,
    saveSession,
    restoreSession,
    clearHistory
  }
})
