<script setup lang="ts">
import type { Track } from '@/types'
import { usePlayerStore } from '@/stores/player'

defineProps<{
  results: Track[]
  loading: boolean
  query: string
}>()

const emit = defineEmits<{
  play: [trackId: string]
  'add-to-queue': [trackId: string]
}>()

const playerStore = usePlayerStore()

function isCurrentTrack(trackId: string) {
  return playerStore.currentTrack?.id === trackId
}
</script>

<template>
  <div class="search-results">
    <div v-if="loading" class="search-results__loading">
      搜索中...
    </div>

    <div v-else-if="results.length === 0 && query" class="search-results__empty">
      未找到与 "{{ query }}" 相关的歌曲
    </div>

    <div v-else-if="results.length === 0" class="search-results__empty">
      输入关键词开始搜索
    </div>

    <ul v-else class="search-results__list">
      <li
        v-for="track in results"
        :key="track.id"
        class="search-result-item"
        :class="{ 'search-result-item--active': isCurrentTrack(track.id) }"
      >
        <button class="search-result-item__play" @click="emit('play', track.id)" aria-label="播放">
          <svg v-if="isCurrentTrack(track.id) && playerStore.isPlaying" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1" />
            <rect x="14" y="4" width="4" height="16" rx="1" />
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
        <div class="search-result-item__info">
          <p class="search-result-item__title">{{ track.title }}</p>
          <p class="search-result-item__artist">{{ track.artist }}</p>
        </div>
        <button
          class="search-result-item__add"
          @click="emit('add-to-queue', track.id)"
          aria-label="添加到队列"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          </svg>
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.search-results {
  max-height: 400px;
  overflow-y: auto;
}

.search-results__loading,
.search-results__empty {
  padding: var(--spacing-lg);
  text-align: center;
  color: var(--text-tertiary);
  font-size: 0.85rem;
}

.search-results__list {
  display: flex;
  flex-direction: column;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  cursor: default;
  transition: background var(--transition-fast);
}

.search-result-item:hover {
  background: var(--bg-tertiary);
}

.search-result-item--active {
  background: var(--bg-tertiary);
}

.search-result-item__play {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
}

.search-result-item__play:hover {
  color: var(--color-primary);
}

.search-result-item__info {
  flex: 1;
  min-width: 0;
}

.search-result-item__title {
  font-size: 0.9rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-result-item__artist {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.search-result-item__add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  flex-shrink: 0;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.search-result-item:hover .search-result-item__add {
  opacity: 1;
}

.search-result-item__add:hover {
  color: var(--color-primary);
}
</style>
