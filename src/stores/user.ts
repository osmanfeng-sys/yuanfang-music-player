import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import { STORAGE_PREFIX, MAX_HISTORY } from '@/utils/constants'

export type ThemeMode = 'light' | 'dark' | 'system'

interface SavedSession {
  queue: string[]
  currentIndex: number
  currentTime: number
}

function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    // localStorage 满时静默失败
  }
}

export const useUserStore = defineStore('user', () => {
  // ===== State（从 localStorage 加载） =====

  const theme = ref<ThemeMode>(loadJSON<ThemeMode>('theme', 'system'))
  const playHistory = ref<string[]>(loadJSON<string[]>('history', []))
  const favorites = ref<string[]>(loadJSON<string[]>('favorites', []))
  const favoritePlaylists = ref<string[]>(loadJSON<string[]>('favPlaylists', []))
  const lastSession = ref<SavedSession | null>(loadJSON<SavedSession | null>('session', null))
  const initialized = ref(false)

  // ===== 自动持久化 =====

  watch(theme, (v) => saveJSON('theme', v))
  watch(playHistory, (v) => saveJSON('history', v))
  watch(favorites, (v) => saveJSON('favorites', v))
  watch(favoritePlaylists, (v) => saveJSON('favPlaylists', v))
  watch(lastSession, (v) => saveJSON('session', v), { deep: true })

  // ===== Getters =====

  const isDark = computed(() => {
    if (theme.value === 'dark') return true
    if (theme.value === 'light') return false
    // 'system' — 跟随系统
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    return false
  })

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

  function setTheme(mode: ThemeMode) {
    theme.value = mode
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
    theme,
    playHistory,
    favorites,
    favoritePlaylists,
    lastSession,
    initialized,
    // Getters
    isDark,
    recentTracks,
    isFavorite,
    // Actions
    init,
    setTheme,
    addToHistory,
    toggleFavorite,
    saveSession,
    restoreSession,
    clearHistory
  }
})
