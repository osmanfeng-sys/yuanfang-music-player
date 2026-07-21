<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import { fetchAllTracks } from '@/services/music'
import PlaylistItem from '@/components/playlist/PlaylistItem.vue'
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

// 最近播放的曲目（从历史记录反查）
const recentTracks = computed<Track[]>(() => {
  return userStore.playHistory
    .map((id) => playlistStore.getTrackById(id))
    .filter((t): t is Track => t !== undefined)
    .slice(0, 20)
})

// 所有曲目（"全部音乐"）
const allTracks = computed(() => playlistStore.allTracks)

// 随机推荐（从全部曲目中选 10 首）
const recommended = computed(() => {
  const tracks = allTracks.value
  if (tracks.length <= 10) return tracks
  const shuffled = [...tracks].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, 10)
})

// 郑源精选播放列表
const zhengYuanPlaylist = computed(() => {
  return playlistStore.getPlaylistByArtist('郑源')
})
const zhengYuanTracks = computed<Track[]>(() => {
  if (!zhengYuanPlaylist.value) return []
  return zhengYuanPlaylist.value.trackIds
    .map((id) => playlistStore.getTrackById(id))
    .filter((t): t is Track => t !== undefined)
})

onMounted(loadMusic)

function playTrack(trackId: string) {
  const track = playlistStore.getTrackById(trackId)
  if (track) {
    // 如果队列中已有这首歌，直接切换播
    const idx = playerStore.queue.findIndex((t) => t.id === trackId)
    if (idx !== -1 && playerStore.queue.length > 0) {
      playerStore.currentIndex = idx
      playerStore.isPlaying = true
      return
    }
    // 否则重建队列
    playerStore.setQueue([track], 0)
    playerStore.isPlaying = true
  }
}

function playAll(tracks: Track[]) {
  if (tracks.length === 0) return
  playerStore.setQueue(tracks, 0)
  playerStore.isPlaying = true
}

function addToQueue(trackId: string) {
  const track = playlistStore.getTrackById(trackId)
  if (track) {
    playerStore.addToQueue([track])
  }
}
</script>

<template>
  <main class="home">
    <LoadingSpinner v-if="loading" size="lg" text="正在加载音乐库..." />

    <ErrorMessage
      v-else-if="error"
      :message="error"
      :retryable="true"
      @retry="loadMusic"
    />

    <template v-else>
      <!-- 最近播放 -->
      <section v-if="recentTracks.length > 0" class="home__section">
        <h2 class="home__section-title">最近播放</h2>
        <div class="home__track-list">
          <PlaylistItem
            v-for="track in recentTracks"
            :key="track.id"
            :track="track"
            :index="0"
            :is-active="playerStore.currentTrack?.id === track.id"
            @click="playTrack(track.id)"
            @add-to-playlist="addToQueue(track.id)"
          />
        </div>
      </section>

      <!-- 推荐歌曲 -->
      <section class="home__section">
        <h2 class="home__section-title">推荐歌曲</h2>
        <div class="home__track-list">
          <PlaylistItem
            v-for="track in recommended"
            :key="track.id"
            :track="track"
            :index="0"
            :is-active="playerStore.currentTrack?.id === track.id"
            @click="playTrack(track.id)"
            @add-to-playlist="addToQueue(track.id)"
          />
        </div>
      </section>

      <!-- 郑源精选 -->
      <section v-if="zhengYuanTracks.length > 0" class="home__section">
        <div class="home__section-header">
          <h2 class="home__section-title">🎤 郑源精选</h2>
          <button class="home__play-all-btn" @click="playAll(zhengYuanTracks)">
            ▶ 播放全部
          </button>
        </div>
        <p class="home__count">{{ zhengYuanTracks.length }} 首曲目</p>
        <div class="home__track-list">
          <PlaylistItem
            v-for="track in zhengYuanTracks"
            :key="track.id"
            :track="track"
            :index="0"
            :is-active="playerStore.currentTrack?.id === track.id"
            @click="playTrack(track.id)"
            @add-to-playlist="addToQueue(track.id)"
          />
        </div>
      </section>

      <!-- 全部音乐入口 -->
      <section class="home__section">
        <h2 class="home__section-title">全部音乐</h2>
        <p class="home__count">{{ allTracks.length }} 首曲目</p>
        <router-link to="/browse" class="home__browse-link">
          浏览全部艺人 →
        </router-link>
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
}

.home__section {
  margin-bottom: var(--spacing-xl);
}

.home__section-header {
  display: flex;
  align-items: center;
  gap: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
}

.home__section-title {
  font-size: 1.2rem;
  font-weight: 700;
}

.home__play-all-btn {
  background: var(--color-primary);
  color: #fff;
  border: none;
  padding: 4px 14px;
  border-radius: var(--radius-full);
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.home__play-all-btn:hover {
  background: var(--color-primary-hover);
}

.home__track-list {
  display: flex;
  flex-direction: column;
}

.home__count {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-sm);
}

.home__browse-link {
  display: inline-block;
  margin-top: var(--spacing-sm);
  color: var(--color-primary);
  font-size: 0.9rem;
  font-weight: 600;
}

.home__browse-link:hover {
  color: var(--color-primary-hover);
}
</style>
