<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { fetchArtistDetail } from '@/services/music'
import PlaylistItem from '@/components/playlist/PlaylistItem.vue'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ErrorMessage from '@/components/common/ErrorMessage.vue'
import type { Track, Artist } from '@/types'

const route = useRoute()
const router = useRouter()
const playerStore = usePlayerStore()
const id = route.params.id as string

const artist = ref<Artist | null>(null)
const tracks = ref<Track[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

async function loadArtist() {
  loading.value = true
  error.value = null
  try {
    const result = await fetchArtistDetail(id)
    if (result) {
      artist.value = result.artist
      tracks.value = result.tracks
    } else {
      error.value = '未找到该艺人'
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : '加载失败'
  } finally {
    loading.value = false
  }
}

onMounted(loadArtist)

function playTrack(trackId: string) {
  playerStore.setQueue(tracks.value)
  playerStore.playTrack(trackId)
  router.push('/')
}

function playAll() {
  if (tracks.value.length > 0) {
    playerStore.setQueue(tracks.value, 0)
    playerStore.isPlaying = true
    router.push('/')
  }
}
</script>

<template>
  <main class="artist-detail">
    <LoadingSpinner v-if="loading" text="加载艺人信息..." />

    <ErrorMessage
      v-else-if="error"
      :message="error"
      :retryable="true"
      @retry="loadArtist"
    />

    <template v-else-if="artist">
      <div class="artist-detail__header">
        <div class="artist-detail__cover">
          <svg width="160" height="160" viewBox="0 0 120 120" fill="none">
            <defs>
              <linearGradient id="artist-cover" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#1DB954"/>
                <stop offset="100%" stop-color="#148a3c"/>
              </linearGradient>
            </defs>
            <rect width="120" height="120" rx="16" fill="url(#artist-cover)"/>
            <circle cx="60" cy="52" r="16" fill="rgba(255,255,255,0.2)"/>
            <path d="M42 86c0-10 8-18 18-18s18 8 18 18" stroke="rgba(255,255,255,0.4)" stroke-width="3.5" fill="none" stroke-linecap="round"/>
            <path d="M57 42l18-5v18M57 55l18-5" stroke="#fff" stroke-width="2.5" stroke-linecap="round" fill="none"/>
          </svg>
        </div>
        <div class="artist-detail__info">
          <h1 class="artist-detail__name">{{ artist.name }}</h1>
          <p class="artist-detail__count">{{ tracks.length }} 首歌曲</p>
          <button class="artist-detail__play-all" @click="playAll">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            播放全部
          </button>
        </div>
      </div>

      <div class="artist-detail__tracks">
        <h2 class="artist-detail__section-title">歌曲列表</h2>
        <div v-if="tracks.length === 0" class="artist-detail__empty">
          暂无歌曲
        </div>
        <div v-else>
          <PlaylistItem
            v-for="(track, index) in tracks"
            :key="track.id"
            :track="track"
            :index="index"
            :is-active="playerStore.currentTrack?.id === track.id"
            @click="playTrack(track.id)"
          />
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.artist-detail {
  padding: var(--spacing-lg);
  max-width: var(--content-max-width);
  margin: 0 auto;
  width: 100%;
}

.artist-detail__header {
  display: flex;
  gap: var(--spacing-lg);
  align-items: flex-end;
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--bg-tertiary);
}

.artist-detail__cover {
  flex-shrink: 0;
  border-radius: var(--radius-lg);
  overflow: hidden;
  width: 160px;
  height: 160px;
}

.artist-detail__info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.artist-detail__name {
  font-size: 2rem;
  font-weight: 700;
}

.artist-detail__count {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.artist-detail__play-all {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
  margin-top: var(--spacing-sm);
  padding: var(--spacing-sm) var(--spacing-lg);
  background: var(--color-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-full);
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
  transition: background var(--transition-fast);
  width: fit-content;
}

.artist-detail__play-all:hover {
  background: var(--color-primary-hover);
}

.artist-detail__tracks {
  margin-top: var(--spacing-md);
}

.artist-detail__section-title {
  font-size: 1.1rem;
  font-weight: 600;
  margin-bottom: var(--spacing-md);
}

.artist-detail__empty {
  color: var(--text-tertiary);
  text-align: center;
  padding: var(--spacing-lg);
}

@media (max-width: 639px) {
  .artist-detail__header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
  .artist-detail__play-all {
    margin: var(--spacing-sm) auto 0;
  }
}
</style>
