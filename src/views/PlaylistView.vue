<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlist'
import { usePlayerStore } from '@/stores/player'
import { usePlaylist } from '@/composables/usePlaylist'
import PlaylistItem from '@/components/playlist/PlaylistItem.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { Track } from '@/types'

const route = useRoute()
const router = useRouter()
const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()
const { getTracksFromPlaylist, playPlaylist } = usePlaylist()

const playlistId = route.params.id as string
const playlist = computed(() => playlistStore.getPlaylistById(playlistId))
const tracks = computed<Track[]>(() =>
  playlist.value ? getTracksFromPlaylist(playlist.value) : []
)

function playTrack(trackId: string) {
  if (!playlist.value) return
  const index = playlist.value.trackIds.indexOf(trackId)
  if (index >= 0) {
    playPlaylist(playlist.value, index)
  }
}

function removeTrack(trackId: string) {
  if (!playlist.value) return
  playlistStore.removeFromPlaylist(playlist.value.id, trackId)
}

function goBack() {
  router.back()
}
</script>

<template>
  <main class="playlist-detail">
    <button class="playlist-detail__back" @click="goBack">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
      返回
    </button>

    <template v-if="!playlist">
      <EmptyState icon="playlist" title="播放列表未找到" description="该列表可能已被删除" />
    </template>

    <template v-else>
      <div class="playlist-detail__header">
        <div class="playlist-detail__cover">
          <svg width="160" height="160" viewBox="0 0 24 24" fill="none">
            <rect width="24" height="24" rx="4" fill="var(--bg-tertiary)" />
            <path d="M8 6h13M8 12h13M8 18h9" stroke="var(--text-tertiary)" stroke-width="1.5" stroke-linecap="round" />
            <circle cx="3" cy="6" r="1" fill="var(--text-tertiary)" />
            <circle cx="3" cy="12" r="1" fill="var(--text-tertiary)" />
            <circle cx="3" cy="18" r="1" fill="var(--text-tertiary)" />
          </svg>
        </div>
        <div class="playlist-detail__info">
          <h1 class="playlist-detail__name">{{ playlist.name }}</h1>
          <p class="playlist-detail__meta">
            {{ tracks.length }} 首歌曲
            <span v-if="playlist.description">· {{ playlist.description }}</span>
          </p>
          <button
            v-if="tracks.length > 0"
            class="playlist-detail__play-all"
            @click="playPlaylist(playlist, 0)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            播放全部
          </button>
        </div>
      </div>

      <div class="playlist-detail__tracks">
        <EmptyState
          v-if="tracks.length === 0"
          icon="playlist"
          title="播放列表为空"
          description="添加一些歌曲到这个列表"
        />
        <div v-else>
          <PlaylistItem
            v-for="track in tracks"
            :key="track.id"
            :track="track"
            :index="playlist.trackIds.indexOf(track.id)"
            :is-active="playerStore.currentTrack?.id === track.id"
            :show-remove="playlist.source === 'user'"
            @click="playTrack(track.id)"
            @remove="removeTrack(track.id)"
          />
        </div>
      </div>
    </template>
  </main>
</template>

<style scoped>
.playlist-detail {
  padding: var(--spacing-lg);
  max-width: var(--content-max-width);
  margin: 0 auto;
  width: 100%;
}

.playlist-detail__back {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  background: none;
  border: none;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 0.85rem;
  margin-bottom: var(--spacing-md);
  padding: var(--spacing-xs) var(--spacing-sm);
  border-radius: var(--radius-sm);
}

.playlist-detail__back:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

.playlist-detail__header {
  display: flex;
  gap: var(--spacing-lg);
  align-items: flex-end;
  margin-bottom: var(--spacing-xl);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--bg-tertiary);
}

.playlist-detail__cover {
  flex-shrink: 0;
  border-radius: var(--radius-lg);
  overflow: hidden;
  width: 160px;
  height: 160px;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
}

.playlist-detail__info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.playlist-detail__name {
  font-size: 1.8rem;
  font-weight: 700;
}

.playlist-detail__meta {
  font-size: 0.9rem;
  color: var(--text-secondary);
}

.playlist-detail__play-all {
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
  width: fit-content;
}

.playlist-detail__play-all:hover {
  background: var(--color-primary-hover);
}

.playlist-detail__tracks {
  margin-top: var(--spacing-md);
}

@media (max-width: 639px) {
  .playlist-detail__header {
    flex-direction: column;
    align-items: center;
    text-align: center;
  }
}
</style>
