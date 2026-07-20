import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Track } from '@/types'

export const useSearchStore = defineStore('search', () => {
  // ===== State =====

  const query = ref('')
  const results = ref<Track[]>([])
  const isSearching = ref(false)
  const searchHistory = ref<string[]>(loadHistory())

  // ===== Getters =====

  const hasResults = computed(() => results.value.length > 0)
  const hasQuery = computed(() => query.value.trim().length > 0)

  // ===== Actions =====

  /** 执行搜索（当前为本地搜索，未来可对接 Worker API） */
  async function search(q: string, trackCache: Record<string, Track>) {
    query.value = q
    if (!q.trim()) {
      results.value = []
      return
    }

    isSearching.value = true
    const qLower = q.toLowerCase()

    // 模拟异步（后续替换为真实 API 调用）
    await new Promise((r) => setTimeout(r, 150))

    const matched = Object.values(trackCache).filter(
      (t) =>
        t.title.toLowerCase().includes(qLower) ||
        t.artist.toLowerCase().includes(qLower)
    )
    results.value = matched
    isSearching.value = false

    // 记录搜索历史
    addToHistory(q)
  }

  function clearResults() {
    results.value = []
    query.value = ''
  }

  // ===== 搜索历史（localStorage 持久化） =====

  function loadHistory(): string[] {
    try {
      const raw = localStorage.getItem('ym:searchHistory')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  }

  function saveHistory() {
    try {
      localStorage.setItem('ym:searchHistory', JSON.stringify(searchHistory.value))
    } catch {
      // 静默失败
    }
  }

  function addToHistory(q: string) {
    searchHistory.value = searchHistory.value.filter((s) => s !== q)
    searchHistory.value.unshift(q)
    if (searchHistory.value.length > 10) {
      searchHistory.value = searchHistory.value.slice(0, 10)
    }
    saveHistory()
  }

  function clearHistory() {
    searchHistory.value = []
    saveHistory()
  }

  return {
    // State
    query,
    results,
    isSearching,
    searchHistory,
    // Getters
    hasResults,
    hasQuery,
    // Actions
    search,
    clearResults,
    clearHistory
  }
})
