<script setup lang="ts">
import type { Track } from '@/types'
import PlaylistItem from './PlaylistItem.vue'
import EmptyState from '@/components/common/EmptyState.vue'

defineProps<{
  tracks: Track[]
  currentIndex: number
  visible: boolean
}>()

const emit = defineEmits<{
  select: [index: number]
  remove: [index: number]
  close: []
}>()
</script>

<template>
  <div v-if="visible" class="playlist-panel">
    <div class="playlist-panel__header">
      <h3 class="playlist-panel__title">播放队列 ({{ tracks.length }})</h3>
      <button class="playlist-panel__close" @click="emit('close')" aria-label="关闭">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <EmptyState
      v-if="tracks.length === 0"
      icon="playlist"
      title="播放队列为空"
      description="选择歌曲添加到队列"
    />

    <div v-else class="playlist-panel__list">
      <PlaylistItem
        v-for="(track, i) in tracks"
        :key="track.id"
        :track="track"
        :index="i"
        :is-active="i === currentIndex"
        :show-remove="true"
        @click="emit('select', i)"
        @remove="emit('remove', i)"
      />
    </div>
  </div>
</template>

<style scoped>
.playlist-panel {
  position: fixed;
  right: 0;
  top: var(--header-height);
  bottom: var(--footer-height);
  width: 320px;
  background: var(--bg-secondary);
  border-left: 1px solid var(--bg-tertiary);
  display: flex;
  flex-direction: column;
  z-index: 90;
}

.playlist-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--bg-tertiary);
}

.playlist-panel__title {
  font-size: 0.9rem;
  font-weight: 600;
}

.playlist-panel__close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.playlist-panel__close:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.playlist-panel__list {
  flex: 1;
  overflow-y: auto;
  padding: var(--spacing-sm) 0;
}
</style>
