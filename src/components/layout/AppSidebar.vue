<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlist'
import { usePlayerStore } from '@/stores/player'

defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const router = useRouter()
const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()

// 全部艺人（按曲目数排序）
const allArtists = computed(() => {
  const allTracks = playlistStore.allTracks
  const trackMap = new Map<string, { name: string; count: number }>()
  for (const track of allTracks) {
    if (!trackMap.has(track.artist)) {
      trackMap.set(track.artist, { name: track.artist, count: 0 })
    }
    trackMap.get(track.artist)!.count++
  }
  return Array.from(trackMap.values())
    .sort((a, b) => b.count - a.count)
    .map((entry) => ({
      id: entry.name.toLowerCase().replace(/\s+/g, '-'),
      name: entry.name,
      trackCount: entry.count
    }))
})

// 全部曲目（播放列表）
const allTracks = computed(() => playlistStore.allTracks)

function playArtistTracks(artistName: string) {
  emit('close')
  const tracks = playlistStore.allTracks.filter((t) => t.artist === artistName)
  if (tracks.length > 0) {
    playerStore.setQueue(tracks, 0)
    playerStore.isPlaying = true
    router.push('/')
  }
}

function playTrack(trackId: string) {
  emit('close')
  const all = allTracks.value
  const idx = all.findIndex(t => t.id === trackId)
  if (idx !== -1) {
    playerStore.setQueue(all, idx)
    playerStore.isPlaying = true
    router.push('/')
  }
}

function navigateTo(path: string) {
  emit('close')
  router.push(path)
}
</script>

<template>
  <!-- 移动端遮罩 -->
  <div
    v-if="isOpen"
    class="sidebar-overlay"
    @click="emit('close')"
  />

  <!-- 侧边栏 -->
  <aside class="sidebar" :class="{ 'sidebar--open': isOpen }">
    <div class="sidebar__header">
      <h2 class="sidebar__title">远方音乐</h2>
      <button class="sidebar__close-btn" @click="emit('close')" aria-label="关闭">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>

    <nav class="sidebar__nav">
      <div class="sidebar__link" @click="navigateTo('/')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        <span>首页</span>
      </div>

      <div class="sidebar__link" @click="navigateTo('/browse')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
          <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span>浏览音乐</span>
      </div>

      <div class="sidebar__link" @click="navigateTo('/search')">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2" />
          <path d="M16.5 16.5l4.5 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span>搜索</span>
      </div>
    </nav>

    <!-- 艺人列表 -->
    <div class="sidebar__section">
      <h3 class="sidebar__section-title">艺人列表</h3>
      <div class="sidebar__scroll-list">
        <div
          v-for="artist in allArtists"
          :key="artist.id"
          class="sidebar__list-item"
          @click="playArtistTracks(artist.name)"
        >
          <span class="sidebar__list-item-name">{{ artist.name }}</span>
          <span class="sidebar__list-item-count">{{ artist.trackCount }}</span>
        </div>
        <div v-if="allArtists.length === 0" class="sidebar__empty-text">暂无艺人</div>
      </div>
    </div>

    <!-- 播放列表 -->
    <div class="sidebar__section">
      <h3 class="sidebar__section-title">播放列表</h3>
      <div class="sidebar__scroll-list">
        <div
          v-for="(track, idx) in allTracks"
          :key="track.id"
          class="sidebar__list-item sidebar__list-item--track"
          :class="{ 'sidebar__list-item--active': playerStore.currentTrack?.id === track.id }"
          @click="playTrack(track.id)"
        >
          <span class="sidebar__list-idx">{{ idx + 1 }}</span>
          <span class="sidebar__list-item-info">
            <span class="sidebar__list-item-title">{{ track.title }}</span>
            <span class="sidebar__list-item-artist">{{ track.artist }}</span>
          </span>
        </div>
        <div v-if="allTracks.length === 0" class="sidebar__empty-text">暂无曲目</div>
      </div>
    </div>
  </aside>
</template>

<style scoped>
/* 移动端遮罩 */
.sidebar-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 90;
}

/* 侧边栏本体：悬浮玻璃面板 */
.sidebar {
  position: fixed;
  top: calc(var(--topbar-height) + 8px);
  left: var(--page-gutter);
  bottom: calc(var(--playerbar-height) + 12px);
  width: var(--sidebar-width);
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-radius);
  display: flex;
  flex-direction: column;
  z-index: 80;
  transition: transform var(--transition-normal);
  overflow: hidden;
}

@media (max-width: 767px) {
  .sidebar {
    left: 0;
    border-radius: 0 var(--panel-radius) var(--panel-radius) 0;
  }
}

/* 桌面端始终显示 */
@media (min-width: 768px) {
  .sidebar {
    transform: translateX(0) !important;
  }
  .sidebar-overlay {
    display: none !important;
  }
}

/* 移动端默认隐藏 */
.sidebar {
  transform: translateX(-100%);
}

.sidebar--open {
  transform: translateX(0);
}

.sidebar__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--spacing-md);
  border-bottom: 1px solid var(--glass-border);
  flex-shrink: 0;
}

.sidebar__title {
  font-size: 0.95rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.9);
}

.sidebar__close-btn {
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
}

@media (min-width: 768px) {
  .sidebar__close-btn {
    display: none;
  }
}

.sidebar__close-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.sidebar__nav {
  display: flex;
  flex-direction: column;
  padding: var(--spacing-sm);
  gap: 2px;
  flex-shrink: 0;
}

.sidebar__link {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  border-radius: var(--radius-sm);
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  font-size: 0.9rem;
  transition: all var(--transition-fast);
  cursor: pointer;
}

.sidebar__link:hover {
  color: #fff;
  background: var(--glass-bg-hover);
}

.sidebar__link.router-link-active {
  color: #fff;
  background: rgba(255, 94, 94, 0.85);
  font-weight: 600;
}

/* 侧边栏区域（可滚动） */
.sidebar__section {
  padding: var(--spacing-sm) var(--spacing-md);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.sidebar__section-title {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: var(--spacing-xs);
  flex-shrink: 0;
}

.sidebar__scroll-list {
  flex: 1;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

.sidebar__scroll-list::-webkit-scrollbar {
  width: 3px;
}

.sidebar__scroll-list::-webkit-scrollbar-track {
  background: transparent;
}

.sidebar__scroll-list::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 2px;
}

.sidebar__list-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: 4px var(--spacing-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.68);
  transition: all var(--transition-fast);
}

.sidebar__list-item:hover {
  color: #fff;
  background: var(--glass-bg-hover);
}

.sidebar__list-item--track {
  gap: var(--spacing-xs);
}

.sidebar__list-item--active {
  color: var(--accent) !important;
  background: rgba(255, 94, 94, 0.18);
}

.sidebar__list-item-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__list-item-count {
  font-size: 0.7rem;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.sidebar__list-idx {
  width: 16px;
  text-align: right;
  font-size: 0.7rem;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.sidebar__list-item-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.sidebar__list-item-title {
  font-size: 0.8rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__list-item-artist {
  font-size: 0.65rem;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar__empty-text {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  padding: var(--spacing-sm) var(--spacing-sm);
}
</style>
