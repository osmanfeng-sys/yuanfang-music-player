<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { usePlaylistStore } from '@/stores/playlist'
import { usePlayerStore } from '@/stores/player'
import SearchBar from '@/components/search/SearchBar.vue'

const userStore = useUserStore()
const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()
const router = useRouter()

const emit = defineEmits<{
  'toggle-sidebar': []
}>()

const activeDropdown = ref<'artist' | 'track' | null>(null)

// 点击外部关闭下拉菜单
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.header__dropdown-group')) {
    activeDropdown.value = null
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))

function toggleDropdown(type: 'artist' | 'track') {
  activeDropdown.value = activeDropdown.value === type ? null : type
}

// 精选艺人（前 8 位，按曲目数排序）
const featuredArtists = computed(() => {
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
    .slice(0, 8)
    .map((entry) => ({
      id: entry.name.toLowerCase().replace(/\s+/g, '-'),
      name: entry.name,
      trackCount: entry.count
    }))
})

// 精选曲目（前 10 首）
const featuredTracks = computed(() => playlistStore.allTracks.slice(0, 10))

function goToArtist(id: string) {
  activeDropdown.value = null
  router.push(`/artist/${id}`)
}

function playTrack(trackId: string) {
  activeDropdown.value = null
  const track = playlistStore.getTrackById(trackId)
  if (track) {
    const idx = playerStore.queue.findIndex((t) => t.id === trackId)
    if (idx !== -1 && playerStore.queue.length > 0) {
      playerStore.currentIndex = idx
      playerStore.isPlaying = true
      return
    }
    playerStore.setQueue([track], 0)
    playerStore.isPlaying = true
  }
}

function playAll() {
  activeDropdown.value = null
  const tracks = featuredTracks.value
  if (tracks.length > 0) {
    playerStore.setQueue(tracks, 0)
    playerStore.isPlaying = true
  }
}

function toggleTheme() {
  const next = userStore.theme === 'dark' ? 'light' : 'dark'
  userStore.setTheme(next)
}
</script>

<template>
  <header class="header">
    <div class="header__left">
      <button class="header__menu-btn" @click="emit('toggle-sidebar')" aria-label="菜单">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>

      <router-link to="/" class="header__logo">
        <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
          <circle cx="16" cy="16" r="14" fill="var(--color-primary)" />
          <path d="M11 22V10l12 6-12 6z" fill="#fff" />
        </svg>
        <span class="header__title">远方音乐</span>
      </router-link>

      <nav class="header__nav">
        <router-link to="/" class="nav-link" :class="{ active: $route.path === '/' }">
          首页
        </router-link>

        <!-- 精选艺人下拉菜单 -->
        <div class="header__dropdown-group">
          <button
            class="nav-link nav-link--dropdown"
            :class="{ active: activeDropdown === 'artist' }"
            @click.stop="toggleDropdown('artist')"
          >
            精选艺人
            <svg class="dropdown-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="activeDropdown === 'artist'" class="dropdown-menu" @click.stop>
            <div
              v-for="artist in featuredArtists"
              :key="artist.id"
              class="dropdown-item"
              @click="goToArtist(artist.id)"
            >
              <span class="dropdown-item-name">{{ artist.name }}</span>
              <span class="dropdown-item-count">{{ artist.trackCount }} 首</span>
            </div>
            <div v-if="featuredArtists.length === 0" class="dropdown-item dropdown-item--empty">
              暂无艺人数据
            </div>
          </div>
        </div>

        <!-- 精选曲目下拉菜单 -->
        <div class="header__dropdown-group">
          <button
            class="nav-link nav-link--dropdown"
            :class="{ active: activeDropdown === 'track' }"
            @click.stop="toggleDropdown('track')"
          >
            精选曲目
            <svg class="dropdown-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none">
              <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
          <div v-if="activeDropdown === 'track'" class="dropdown-menu dropdown-menu--wide" @click.stop>
            <div
              v-for="(track, idx) in featuredTracks"
              :key="track.id"
              class="dropdown-item"
              @click="playTrack(track.id)"
            >
              <span class="dropdown-idx">{{ idx + 1 }}</span>
              <span class="dropdown-info">
                <span class="dropdown-title">{{ track.title }}</span>
                <span class="dropdown-artist">{{ track.artist }}</span>
              </span>
            </div>
            <div v-if="featuredTracks.length === 0" class="dropdown-item dropdown-item--empty">
              暂无曲目数据
            </div>
          </div>
        </div>

        <!-- 播放全部按钮 -->
        <button class="nav-link nav-link--playall" @click="playAll" title="播放全部精选曲目">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
          播放全部
        </button>
      </nav>
    </div>

    <div class="header__center">
      <SearchBar />
    </div>

    <div class="header__right">
      <button
        class="header__theme-btn"
        @click="toggleTheme"
        :aria-label="userStore.isDark ? '切换亮色模式' : '切换暗色模式'"
      >
        <svg v-if="userStore.isDark" width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="2" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
        <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>

      <router-link to="/settings" class="header__settings-btn" aria-label="设置">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2" />
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </router-link>
    </div>
  </header>
</template>

<style scoped>
.header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--header-height);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 var(--spacing-md);
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--bg-tertiary);
  z-index: 100;
  gap: var(--spacing-sm);
}

.header__left {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  flex-shrink: 0;
  min-width: 0;
}

.header__menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  color: var(--text-primary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.header__menu-btn:hover {
  background: var(--bg-tertiary);
}

@media (min-width: 768px) {
  .header__menu-btn {
    display: none;
  }
}

.header__logo {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  text-decoration: none;
  color: var(--text-primary);
  flex-shrink: 0;
}

.header__title {
  font-size: 1.1rem;
  font-weight: 700;
}

.header__nav {
  display: none;
  gap: var(--spacing-xs);
  align-items: center;
}

@media (min-width: 1024px) {
  .header__nav {
    display: flex;
  }
}

.nav-link {
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
  color: var(--text-secondary);
  text-decoration: none;
  font-size: 0.85rem;
  white-space: nowrap;
  transition: color var(--transition-fast);
  cursor: pointer;
  background: none;
  border: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.nav-link:hover {
  color: var(--text-primary);
}

.nav-link.active {
  color: var(--text-primary);
  font-weight: 600;
}

.nav-link--dropdown {
  position: relative;
}

.dropdown-arrow {
  transition: transform var(--transition-fast);
}

.nav-link--dropdown.active .dropdown-arrow {
  transform: rotate(180deg);
}

.nav-link--playall {
  color: var(--color-primary);
  font-weight: 600;
}

.nav-link--playall:hover {
  color: var(--color-primary-hover);
}

/* ===== 下拉菜单 ===== */
.header__dropdown-group {
  position: relative;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  min-width: 180px;
  background: var(--bg-elevated);
  border: 1px solid var(--bg-tertiary);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  z-index: 200;
  padding: var(--spacing-xs) 0;
  max-height: 360px;
  overflow-y: auto;
}

.dropdown-menu--wide {
  min-width: 320px;
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-md);
  cursor: pointer;
  transition: background var(--transition-fast);
  color: var(--text-primary);
  font-size: 0.85rem;
}

.dropdown-item:hover {
  background: var(--bg-tertiary);
}

.dropdown-item--empty {
  color: var(--text-tertiary);
  cursor: default;
  justify-content: center;
}

.dropdown-item-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-item-count {
  font-size: 0.75rem;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.dropdown-idx {
  width: 20px;
  text-align: right;
  font-size: 0.75rem;
  color: var(--text-tertiary);
  flex-shrink: 0;
}

.dropdown-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.dropdown-title {
  font-size: 0.85rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.dropdown-artist {
  font-size: 0.75rem;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ===== Header center/right ===== */
.header__center {
  flex: 1;
  display: flex;
  justify-content: center;
  max-width: 360px;
}

@media (max-width: 1023px) {
  .header__center {
    display: none;
  }
}

.header__right {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-shrink: 0;
}

.header__theme-btn,
.header__settings-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
}

.header__theme-btn:hover,
.header__settings-btn:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}
</style>
