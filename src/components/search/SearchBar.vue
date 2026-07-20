<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useSearchStore } from '@/stores/search'
import { usePlaylistStore } from '@/stores/playlist'
import { SEARCH_DEBOUNCE_MS } from '@/utils/constants'

const router = useRouter()
const searchStore = useSearchStore()
const playlistStore = usePlaylistStore()

const inputRef = ref<HTMLInputElement>()
let debounceTimer: ReturnType<typeof setTimeout> | null = null

const emit = defineEmits<{
  focus: []
}>()

function onInput(e: Event) {
  const value = (e.target as HTMLInputElement).value
  searchStore.query = value

  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    if (value.trim()) {
      searchStore.search(value, playlistStore.trackCache)
    } else {
      searchStore.clearResults()
    }
  }, SEARCH_DEBOUNCE_MS)
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && searchStore.query.trim()) {
    router.push({ path: '/search', query: { q: searchStore.query.trim() } })
    inputRef.value?.blur()
  }
}

function onClear() {
  searchStore.clearResults()
  if (inputRef.value) inputRef.value.value = ''
}

function onFocus() {
  emit('focus')
}

defineExpose({ inputRef })
</script>

<template>
  <div class="search-bar">
    <svg class="search-bar__icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
      <path d="M16.5 16.5l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <input
      ref="inputRef"
      class="search-bar__input"
      type="text"
      placeholder="搜索歌曲或艺人..."
      :value="searchStore.query"
      @input="onInput"
      @keydown="onKeydown"
      @focus="onFocus"
    />
    <button
      v-if="searchStore.hasQuery"
      class="search-bar__clear"
      @click="onClear"
      aria-label="清除搜索"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  background: var(--bg-tertiary);
  border-radius: var(--radius-full);
  padding: 0 var(--spacing-md);
  height: 36px;
  width: 200px;
  transition: width var(--transition-normal);
}

.search-bar:focus-within {
  width: 280px;
  background: var(--bg-elevated);
}

.search-bar__icon {
  flex-shrink: 0;
  color: var(--text-tertiary);
}

.search-bar__input {
  flex: 1;
  background: none;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 0.85rem;
  line-height: 1;
}

.search-bar__input::placeholder {
  color: var(--text-tertiary);
}

.search-bar__clear {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 50%;
  padding: 0;
}

.search-bar__clear:hover {
  color: var(--text-primary);
}
</style>
