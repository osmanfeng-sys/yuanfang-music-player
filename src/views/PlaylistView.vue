<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
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

// ===== 从曲库添加 =====

const showAdd = ref(false)
const keyword = ref('')

/** 复用 store 已有的全文搜索；截断到 50 条免得一次渲染太重 */
const searchResults = computed<Track[]>(() => {
  const q = keyword.value.trim()
  return q ? playlistStore.searchTracks(q).slice(0, 50) : []
})

function isInPlaylist(trackId: string) {
  return playlist.value?.trackIds.includes(trackId) ?? false
}

async function addTrack(trackId: string) {
  if (!playlist.value || isInPlaylist(trackId)) return
  await playlistStore.addToPlaylist(playlist.value.id, trackId)
}

onMounted(async () => {
  // 直接粘 /playlist/xxx 进来时曲库还没加载过，那样搜索永远搜不到东西
  if (playlistStore.allTracks.length === 0) await playlistStore.fetchPlaylists()
  await playlistStore.loadUserPlaylists()
})

function playTrack(trackId: string) {
  if (!playlist.value) return
  const index = playlist.value.trackIds.indexOf(trackId)
  if (index >= 0) {
    playPlaylist(playlist.value, index)
  }
}

async function removeTrack(trackId: string) {
  if (!playlist.value) return
  await playlistStore.removeFromPlaylist(playlist.value.id, trackId)
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
          <div class="playlist-detail__actions">
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
            <button class="playlist-detail__add-toggle" @click="showAdd = !showAdd">
              {{ showAdd ? '收起' : '＋ 从曲库添加' }}
            </button>
          </div>
        </div>
      </div>

      <!-- 从曲库添加：搜索框 + 结果，点结果（或行尾的 ＋）即加入本歌单 -->
      <div v-if="showAdd" class="playlist-detail__add-panel">
        <input
          v-model="keyword"
          class="playlist-detail__search"
          type="search"
          placeholder="搜索歌名 / 歌手，点结果即加入本歌单"
        />
        <p v-if="keyword.trim() && searchResults.length === 0" class="playlist-detail__add-empty">
          没有匹配的曲目
        </p>
        <div v-else class="playlist-detail__add-results">
          <PlaylistItem
            v-for="(t, i) in searchResults"
            :key="t.id"
            :track="t"
            :index="i"
            :added="isInPlaylist(t.id)"
            @click="addTrack(t.id)"
            @add-to-playlist="addTrack($event)"
          />
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
  height: 100%;
  overflow-y: auto;
  padding: var(--spacing-lg);
  width: 100%;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-radius);
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

.playlist-detail__actions {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-top: var(--spacing-sm);
}

.playlist-detail__play-all {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-sm);
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

.playlist-detail__add-toggle {
  padding: var(--spacing-sm) var(--spacing-lg);
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--bg-elevated);
  border-radius: var(--radius-full);
  font-size: 0.9rem;
  cursor: pointer;
  transition: all var(--transition-fast);
}

.playlist-detail__add-toggle:hover {
  color: var(--text-primary);
  border-color: var(--text-tertiary);
}

/* ===== 从曲库添加 ===== */
.playlist-detail__add-panel {
  margin-bottom: var(--spacing-lg);
  padding-bottom: var(--spacing-lg);
  border-bottom: 1px solid var(--bg-tertiary);
}

.playlist-detail__search {
  width: 100%;
  height: 34px;
  padding: 0 12px;
  font-size: 0.85rem;
  color: var(--text-primary);
  background: var(--bg-tertiary);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  outline: none;
}

.playlist-detail__search:focus {
  border-color: var(--color-primary);
}

.playlist-detail__add-empty {
  padding: var(--spacing-md) 0;
  font-size: 0.85rem;
  color: var(--text-tertiary);
}

.playlist-detail__add-results {
  margin-top: var(--spacing-sm);
  max-height: 320px;
  overflow-y: auto;
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
