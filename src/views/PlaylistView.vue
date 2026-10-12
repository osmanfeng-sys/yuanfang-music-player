<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlist'
import { usePlayerStore } from '@/stores/player'
import { usePlaylist } from '@/composables/usePlaylist'
import PlaylistItem from '@/components/playlist/PlaylistItem.vue'
import AddTracksModal from '@/components/playlist/AddTracksModal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { loadCredentials } from '@/utils/userKey'
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

// ===== 同步状态 =====

const cloudOn = loadCredentials() !== null

/** 该歌单是否有没写进云端的改动（写入失败过） */
const isUnsynced = computed(() =>
  playlist.value ? playlistStore.unsyncedIds.includes(playlist.value.id) : false
)

/** 按钮文案与状态：仅本机 / 待同步（橙，可点）/ 已同步（绿，禁用） */
const syncState = computed(() => {
  if (!cloudOn) return { key: 'local', text: '仅本机', title: '未开启云端同步，歌单只存在这台设备' }
  if (isUnsynced.value) return { key: 'pending', text: '同步', title: '有改动没同步到云端，点这里重试' }
  return { key: 'synced', text: '已同步', title: '已保存到云端' }
})

async function doSync() {
  if (!playlist.value || !isUnsynced.value) return
  await playlistStore.syncPlaylist(playlist.value.id)
}

// ===== 从曲库添加 =====

const showAdd = ref(false)

/** 已在歌单里的 id —— 传给弹层置灰，从根上避免重复添加 */
const excludeIds = computed(() => playlist.value?.trackIds ?? [])

async function onConfirmAdd(ids: string[]) {
  if (!playlist.value) return
  for (const id of ids) {
    await playlistStore.addToPlaylist(playlist.value.id, id)
  }
  showAdd.value = false
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

/**
 * 跳到首页的「正在播放」页签。
 *
 * 带 `?tab=playing` 而不是光 push('/')：首页的页签是组件本地状态，
 * 而它在没有当前曲目时会自动落到「播放乐库」—— 只 push('/') 的话
 * 没在播歌时就会跳到别的页签，与按钮名字对不上。
 */
function goPlaying() {
  router.push({ path: '/', query: { tab: 'playing' } })
}
</script>

<template>
  <main class="playlist-detail">
    <div class="playlist-detail__nav">
      <button class="playlist-detail__back" @click="goBack">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M19 12H5M12 19l-7-7 7-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
        返回歌单
      </button>

      <button class="playlist-detail__goto" @click="goPlaying">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8 5v14l11-7z" />
        </svg>
        正在播放
      </button>
    </div>

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
            <button class="playlist-detail__add-toggle" @click="showAdd = true">
              ＋ 从曲库添加
            </button>
            <!-- 同步状态：仅本机（灰）/ 待同步（橙，可点）/ 已同步（绿，禁用）。
                 "未保存"只发生在云端写入失败时 —— 正常改动是即时写云端的 -->
            <button
              class="playlist-detail__sync"
              :class="`playlist-detail__sync--${syncState.key}`"
              :disabled="syncState.key !== 'pending'"
              :title="syncState.title"
              @click="doSync"
            >
              {{ syncState.text }}
            </button>
          </div>
        </div>
      </div>

      <!-- 从曲库添加：一级音乐夹 → 二级曲目 → 勾选多首一次加入。
           换成弹层是因为原来的「搜索 + 单首点加」有两个实际痛点：
           一次只能加一首，而且必须先知道歌名 —— 想「把这张专辑整张加进去」很难用 -->
      <AddTracksModal
        :open="showAdd"
        :exclude-ids="excludeIds"
        @close="showAdd = false"
        @confirm="onConfirmAdd"
      />

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

/* 导航行：「返回歌单」+ 跳「正在播放」 */
.playlist-detail__nav {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  flex-wrap: wrap;
  margin-bottom: var(--spacing-md);
}

.playlist-detail__back,
.playlist-detail__goto {
  display: inline-flex;
  align-items: center;
  gap: var(--spacing-xs);
  padding: var(--spacing-xs) var(--spacing-sm);
  font-size: 0.85rem;
  color: var(--text-secondary);
  background: none;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.playlist-detail__back:hover,
.playlist-detail__goto:hover {
  color: var(--text-primary);
  background: var(--bg-tertiary);
}

/* 跳转按钮描个边，跟「返回」区分开 */
.playlist-detail__goto {
  color: var(--text-primary);
  border-color: var(--bg-elevated);
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

/* 同步状态按钮：颜色即状态，不需要文字解释 */
.playlist-detail__sync {
  padding: var(--spacing-sm) var(--spacing-lg);
  font-size: 0.9rem;
  font-weight: 600;
  border: 1px solid transparent;
  border-radius: var(--radius-full);
  cursor: default;
}

.playlist-detail__sync--local {
  color: var(--text-tertiary);
  background: transparent;
  border-color: var(--bg-elevated);
}

.playlist-detail__sync--pending {
  color: #fff;
  background: #e8912d; /* 橙：有改动没同步，可点重试 */
  cursor: pointer;
}

.playlist-detail__sync--pending:hover {
  background: #f0a044;
}

.playlist-detail__sync--synced {
  color: #4cd964; /* 绿：已落云端，不可点 */
  background: transparent;
  border-color: rgba(76, 217, 100, 0.5);
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
