<script setup lang="ts">
import type { Track } from '@/types'
import { formatTime } from '@/utils/format'

const props = defineProps<{
  track: Track
  index: number
  isActive?: boolean
  showRemove?: boolean
}>()

const emit = defineEmits<{
  click: [trackId: string]
  remove: [trackId: string]
  'add-to-playlist': [trackId: string]
}>()

function onClick() {
  emit('click', props.track.id)
}
</script>

<template>
  <div
    class="playlist-item"
    :class="{ 'playlist-item--active': isActive }"
    @dblclick="onClick"
    role="button"
    tabindex="0"
  >
    <span class="playlist-item__index">{{ isActive ? '♪' : index + 1 }}</span>
    <div class="playlist-item__info">
      <p class="playlist-item__title">{{ track.title }}</p>
      <p class="playlist-item__artist">{{ track.artist }}</p>
    </div>
    <span v-if="track.duration" class="playlist-item__duration">
      {{ formatTime(track.duration) }}
    </span>
    <div class="playlist-item__actions">
      <button
        class="playlist-item__btn"
        @click.stop="emit('add-to-playlist', track.id)"
        aria-label="添加到播放列表"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M8 6h13M8 12h13M8 18h9" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
          <circle cx="3" cy="6" r="1" fill="currentColor" />
          <circle cx="3" cy="12" r="1" fill="currentColor" />
          <circle cx="3" cy="18" r="1" fill="currentColor" />
        </svg>
      </button>
      <button
        v-if="showRemove"
        class="playlist-item__btn playlist-item__btn--remove"
        @click.stop="emit('remove', track.id)"
        aria-label="移除"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
  </div>
</template>

<style scoped>
.playlist-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.playlist-item:hover {
  background: var(--bg-tertiary);
}

.playlist-item--active {
  background: var(--bg-tertiary);
}

.playlist-item--active .playlist-item__title {
  color: var(--color-primary);
}

.playlist-item__index {
  width: 24px;
  text-align: center;
  font-size: 0.8rem;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.playlist-item--active .playlist-item__index {
  color: var(--color-primary);
  font-weight: 600;
}

.playlist-item__info {
  flex: 1;
  min-width: 0;
}

.playlist-item__title {
  font-size: 0.85rem;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.playlist-item__artist {
  font-size: 0.75rem;
  color: var(--text-secondary);
}

.playlist-item__duration {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
}

.playlist-item__actions {
  display: flex;
  gap: 2px;
  opacity: 0;
  transition: opacity var(--transition-fast);
}

.playlist-item:hover .playlist-item__actions {
  opacity: 1;
}

.playlist-item__btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: none;
  border: none;
  color: var(--text-tertiary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.playlist-item__btn:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}
</style>
