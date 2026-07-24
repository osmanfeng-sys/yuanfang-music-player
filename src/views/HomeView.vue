<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import { fetchAllTracks } from '@/services/music'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ErrorMessage from '@/components/common/ErrorMessage.vue'
import type { Track } from '@/types'

const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()
const userStore = useUserStore()

const loading = ref(true)
const error = ref<string | null>(null)

async function loadMusic() {
  loading.value = true
  error.value = null
  try {
    const tracks = await fetchAllTracks()
    if (tracks.length > 0) {
      const cache: Record<string, Track> = {}
      for (const t of tracks) {
        cache[t.id] = t
      }
      playlistStore.trackCache = cache
    }
  } catch (e) {
    error.value = '无法连接到服务器，请检查网络'
  } finally {
    loading.value = false
  }
}

const allTracks = computed(() => playlistStore.allTracks)

// 背景图片 URL（public 目录引用）
const bgImageUrl = '/PIC/IMG_0776.JPG'
const totalTracks = computed(() => allTracks.value.length)
const totalArtists = computed(() => {
  const names = new Set(allTracks.value.map((t) => t.artist))
  return names.size
})

// 最近播放（最多 10 首）
const recentTracks = computed<Track[]>(() => {
  return userStore.playHistory
    .map((id) => playlistStore.getTrackById(id))
    .filter((t): t is Track => t !== undefined)
    .slice(0, 10)
})

onMounted(loadMusic)

function playTrack(trackId: string) {
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
</script>

<template>
  <main class="home">
    <!-- 全屏固定背景 -->
    <div class="home__bg">
      <img :src="bgImageUrl" alt="" class="home__bg-img" />
      <div class="home__bg-overlay" />
    </div>

    <LoadingSpinner v-if="loading" size="lg" text="正在加载音乐库..." />

    <ErrorMessage
      v-else-if="error"
      :message="error"
      :retryable="true"
      @retry="loadMusic"
    />

    <template v-else>
      <!-- 1. Hero 区域 -->
      <section class="home__hero">
        <h1 class="home__hero-title">远方音乐</h1>
        <p class="home__hero-subtitle">
          共 {{ totalTracks }} 首曲目 · {{ totalArtists }} 位艺人
        </p>
        <router-link to="/browse" class="home__hero-link">
          浏览全部音乐 →
        </router-link>
      </section>

      <!-- 2. 绿色音乐可视化背景（使用自然风景图做底） -->
      <section class="home__visualizer">
        <template v-if="!playerStore.currentTrack">
          <div class="home__visualizer-idle">
            <svg class="home__visualizer-icon" width="56" height="56" viewBox="0 0 24 24" fill="none">
              <path d="M9 18V5l12-2v13" stroke="#1DB954" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
              <circle cx="6" cy="18" r="3" stroke="#1DB954" stroke-width="1.8"/>
              <circle cx="18" cy="16" r="3" stroke="#1DB954" stroke-width="1.8"/>
            </svg>
            <p class="home__visualizer-text">选择歌曲开始播放</p>
          </div>
        </template>

        <template v-else>
          <div class="home__equalizer">
            <div
              v-for="i in 24"
              :key="i"
              class="home__equalizer-bar"
              :class="{ 'home__equalizer-bar--playing': playerStore.isPlaying }"
              :style="{ animationDelay: `${i * 0.12}s` }"
            />
          </div>
          <div class="home__visualizer-now">
            <p class="home__visualizer-now-text">
              <span v-if="!playerStore.isPlaying" class="home__visualizer-paused">⏸ 已暂停 — </span>
              {{ playerStore.currentTrack.title }} — {{ playerStore.currentTrack.artist }}
            </p>
          </div>
        </template>
      </section>

      <!-- 3. 最近播放 -->
      <section v-if="recentTracks.length > 0" class="home__section">
        <h2 class="home__section-title">最近播放</h2>
        <div class="home__recent-scroll">
          <div
            v-for="track in recentTracks"
            :key="track.id"
            class="home__recent-item"
            @click="playTrack(track.id)"
          >
            <div class="home__recent-cover">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="1.5" fill="none"/>
                <path d="M10 8v8l6-4-6-4z" fill="currentColor"/>
              </svg>
            </div>
            <span class="home__recent-title">{{ track.title }}</span>
            <span class="home__recent-artist">{{ track.artist }}</span>
          </div>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.home {
  padding: var(--spacing-lg);
  max-width: var(--content-max-width);
  margin: 0 auto;
  width: 100%;
  position: relative;
  min-height: calc(100vh - var(--header-height) - var(--footer-height) - var(--spacing-lg) * 2);
}

/* ===== 全屏固定背景 ===== */
.home__bg {
  position: fixed;
  inset: 0;
  z-index: -1;
}

.home__bg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  display: block;
}

.home__bg-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

/* ===== Hero 区域 ===== */
.home__hero {
  text-align: center;
  padding: var(--spacing-xl) 0 var(--spacing-lg);
  margin-bottom: var(--spacing-xl);
}

.home__hero-title {
  font-size: 2rem;
  font-weight: 800;
  margin: 0 0 var(--spacing-sm);
  letter-spacing: -0.02em;
}

.home__hero-subtitle {
  font-size: 0.95rem;
  color: var(--text-secondary);
  margin: 0 0 var(--spacing-md);
}

.home__hero-link {
  display: inline-block;
  color: var(--color-primary);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
  transition: color var(--transition-fast);
}

.home__hero-link:hover {
  color: var(--color-primary-hover);
}

/* ===== 通用 Section ===== */
.home__section {
  margin-bottom: var(--spacing-xl);
}

.home__section-title {
  font-size: 1.2rem;
  font-weight: 700;
  margin: 0 0 var(--spacing-md);
}

/* ===== 绿色音乐可视化 ===== */
.home__visualizer {
  position: relative;
  height: 350px;
  margin-bottom: var(--spacing-xl);
  border-radius: var(--radius-lg);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background-color: rgba(0, 0, 0, 0.25);
  backdrop-filter: blur(4px);
  border: 1px solid rgba(255, 255, 255, 0.06);
}

/* 空闲状态 */
.home__visualizer-idle {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-md);
  position: relative;
  z-index: 1;
}

.home__visualizer-icon {
  opacity: 0.55;
}

.home__visualizer-text {
  color: var(--text-secondary);
  font-size: 0.95rem;
}

/* 均衡器柱条 */
.home__equalizer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 0 var(--spacing-lg);
  z-index: 1;
}

.home__equalizer-bar {
  width: 8px;
  height: 20%;
  border-radius: 4px;
  background: #1DB954;
  box-shadow: 0 0 12px rgba(29, 185, 84, 0.7);
  transition: height 0.3s ease;
}

.home__equalizer-bar--playing {
  animation: equalizer 1.2s ease-in-out infinite;
}

@keyframes equalizer {
  0%, 100% { height: 15%; }
  20% { height: 60%; }
  40% { height: 30%; }
  60% { height: 80%; }
  80% { height: 45%; }
}

/* 底部当前播放文字 */
.home__visualizer-now {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: var(--spacing-md) var(--spacing-lg);
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.75));
  text-align: center;
  z-index: 1;
}

.home__visualizer-now-text {
  margin: 0;
  font-size: 0.85rem;
  color: var(--text-primary);
}

.home__visualizer-paused {
  color: var(--text-secondary);
}

/* ===== 最近播放横向滚动 ===== */
.home__recent-scroll {
  display: flex;
  gap: var(--spacing-sm);
  overflow-x: auto;
  padding-bottom: var(--spacing-sm);
  scrollbar-width: thin;
  scrollbar-color: var(--bg-tertiary) transparent;
}

.home__recent-scroll::-webkit-scrollbar {
  height: 4px;
}

.home__recent-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.home__recent-scroll::-webkit-scrollbar-thumb {
  background: var(--bg-tertiary);
  border-radius: 2px;
}

.home__recent-item {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--spacing-xs);
  width: 120px;
  padding: var(--spacing-sm);
  border-radius: var(--radius-md);
  background: rgba(30, 30, 30, 0.85);
  backdrop-filter: blur(8px);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.home__recent-item:hover {
  background: rgba(40, 40, 40, 0.9);
}

.home__recent-cover {
  width: 64px;
  height: 64px;
  border-radius: var(--radius-md);
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.home__recent-title {
  font-size: 0.8rem;
  font-weight: 500;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}

.home__recent-artist {
  font-size: 0.7rem;
  color: var(--text-secondary);
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
}
</style>
