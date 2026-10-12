<script setup lang="ts">
import type { Track } from '@/types'
import { formatTime } from '@/utils/format'

const props = defineProps<{
  track: Track
  index: number
  isActive?: boolean
  showRemove?: boolean
  /** 已在目标歌单里 —— 加号变对勾并禁用（用于详情页的「从曲库添加」结果） */
  added?: boolean
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
    :class="{ 'playlist-item--active': isActive, 'playlist-item--added': added }"
    @click="onClick"
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
        :class="{ 'playlist-item__btn--added': added }"
        :disabled="added"
        :title="added ? '已在歌单中' : '加入歌单'"
        :aria-label="added ? '已在歌单中' : '加入歌单'"
        @click.stop="emit('add-to-playlist', track.id)"
      >
        <svg v-if="added" width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
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

/* 已加入的条目让对勾常显 —— 触摸屏没有 hover，藏起来就等于没提示 */
.playlist-item--added .playlist-item__actions {
  opacity: 1;
}

.playlist-item__btn--added,
.playlist-item__btn--added:hover {
  color: var(--color-primary);
  background: none;
  cursor: default;
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
