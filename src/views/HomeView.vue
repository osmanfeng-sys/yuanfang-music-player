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
    <!-- 全屏固定背景（永不滚动） -->
    <div
      class="home__bg"
      style="background-image: url('/PIC/IMG_0776.JPG'); background-size: cover; background-position: center;"
    >
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
      <!-- 右侧均衡器（右下角，较矮） -->
      <div class="home__equalizer">
        <template v-if="playerStore.currentTrack">
          <div
            v-for="i in 16"
            :key="i"
            class="home__equalizer-bar"
            :class="{ 'home__equalizer-bar--playing': playerStore.isPlaying }"
            :style="{ animationDelay: `${i * 0.10}s` }"
          />
        </template>
      </div>

      <!-- 底部歌曲信息 -->
      <div v-if="playerStore.currentTrack" class="home__track-info">
        <span v-if="!playerStore.isPlaying" class="home__paused">⏸ </span>
        {{ playerStore.currentTrack.title }} — {{ playerStore.currentTrack.artist }}
      </div>
      <div v-else class="home__track-info home__track-info--idle">
        选择歌曲开始播放
      </div>

      <!-- 最近播放 -->
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

/* ===== 全屏固定背景（占用整个视口，不跟随滚动） ===== */
.home__bg {
  position: fixed;
  inset: 0;
  z-index: 0;
  background-repeat: no-repeat;
  background-attachment: fixed;
}

.home__bg-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
}

/* 确保主页内容在背景之上 */
.home__section,
.home__equalizer,
.home__track-info {
  position: relative;
  z-index: 1;
}

/* Loading/Error 状态也在背景之上 */
.home .spinner,
.home .error {
  position: relative;
  z-index: 1;
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

/* ===== 右下角均衡器（较小、较矮） ===== */
.home__equalizer {
  position: fixed;
  bottom: calc(var(--footer-height) + 12px);
  right: var(--spacing-md);
  display: flex;
  align-items: flex-end;
  gap: 3px;
  z-index: 50;
  height: 36px;
}

.home__equalizer-bar {
  width: 4px;
  height: 6px;
  border-radius: 2px;
  background: #1DB954;
  box-shadow: 0 0 6px rgba(29, 185, 84, 0.6);
  transition: height 0.2s ease;
}

.home__equalizer-bar--playing {
  animation: equalizer 0.9s ease-in-out infinite;
}

@keyframes equalizer {
  0%, 100% { height: 6px; }
  25% { height: 24px; }
  50% { height: 14px; }
  75% { height: 32px; }
}

/* ===== 底部歌曲信息（固定在最底） ===== */
.home__track-info {
  position: fixed;
  bottom: calc(var(--footer-height) + 8px);
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
  z-index: 50;
  white-space: nowrap;
  max-width: 60vw;
  overflow: hidden;
  text-overflow: ellipsis;
  text-align: center;
}

.home__track-info--idle {
  color: rgba(255, 255, 255, 0.45);
  font-size: 0.75rem;
}

.home__paused {
  opacity: 0.6;
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
