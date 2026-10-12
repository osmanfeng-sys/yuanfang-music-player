<script setup lang="ts">
import { computed } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import type { Track } from '@/types'

/**
 * 「把这首加入哪个歌单」的选单。
 *
 * 首页和浏览页的每一行都有个心形按钮，点了就打开它 —— 抽成组件是为了
 * 两个页面共用一份，而不是各写一套。
 *
 * 用居中弹层而不是贴着那一行的小气泡：每行一个气泡在 393 行的列表里
 * 要么全渲染（重），要么得算坐标（脆），弹层最省事且手机上也好点。
 */
const props = defineProps<{ track: Track | null }>()
const emit = defineEmits<{ close: [] }>()

const playlistStore = usePlaylistStore()
const playlists = computed(() => playlistStore.userPlaylists)

/** 这首是否已在该歌单里 */
function alreadyIn(id: string) {
  const p = playlistStore.getPlaylistById(id)
  return p ? p.trackIds.includes(props.track?.id ?? '') : false
}

async function pick(id: string) {
  if (!props.track || alreadyIn(id)) return
  await playlistStore.addToPlaylist(id, props.track.id)
  emit('close')
}
</script>

<template>
  <div v-if="track" class="add-modal" @click.self="emit('close')">
    <div class="add-modal__panel">
      <div class="add-modal__head">
        <span>加入歌单</span>
        <button class="add-modal__x" aria-label="关闭" @click="emit('close')">✕</button>
      </div>

      <p class="add-modal__track">{{ track.title }} — {{ track.artist }}</p>

      <p v-if="playlists.length === 0" class="add-modal__empty">
        还没有歌单。去顶栏「歌单」新建一个，再回来加。
      </p>

      <ul v-else class="add-modal__list">
        <li v-for="p in playlists" :key="p.id">
          <button
            class="add-modal__item"
            :class="{ 'add-modal__item--on': alreadyIn(p.id) }"
            :disabled="alreadyIn(p.id)"
            @click="pick(p.id)"
          >
            <span class="add-modal__name">{{ p.name }}</span>
            <span class="add-modal__count">{{ p.trackIds.length }} 首</span>
            <span class="add-modal__tick">{{ alreadyIn(p.id) ? '✓' : '＋' }}</span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.add-modal {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.add-modal__panel {
  width: min(360px, 88vw);
  max-height: 70vh;
  display: flex;
  flex-direction: column;
  background: rgba(20, 20, 20, 0.94);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-radius);
  overflow: hidden;
}

.add-modal__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px var(--spacing-md);
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--glass-border);
}

.add-modal__x {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  font-size: 12px;
  color: var(--text-secondary);
  background: transparent;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
}

.add-modal__x:hover {
  color: var(--text-primary);
  background: var(--bg-elevated);
}

.add-modal__track {
  padding: 10px var(--spacing-md) 6px;
  font-size: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.add-modal__empty {
  padding: var(--spacing-lg) var(--spacing-md);
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-tertiary);
}

.add-modal__list {
  overflow-y: auto;
  padding: 6px;
}

.add-modal__item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: 9px 10px;
  font-size: 13px;
  color: var(--text-primary);
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  text-align: left;
}

.add-modal__item:hover:not(:disabled) {
  background: var(--bg-tertiary);
}

.add-modal__item--on {
  color: var(--color-primary);
  cursor: default;
}

.add-modal__name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.add-modal__count {
  flex-shrink: 0;
  font-size: 11px;
  color: var(--text-faint);
}

.add-modal__tick {
  flex-shrink: 0;
  width: 14px;
  text-align: center;
  font-size: 12px;
  color: var(--text-faint);
}
</style>
