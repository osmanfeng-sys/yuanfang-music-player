<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { usePlayerStore } from '@/stores/player'
import ArtistList from '@/components/artist/ArtistList.vue'
import AddToPlaylistModal from '@/components/playlist/AddToPlaylistModal.vue'
import { fetchArtists } from '@/services/music'
import { formatTime } from '@/utils/format'
import type { Artist, Track } from '@/types'

const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()

/** 艺人网格沿用原来的数据源；为空时整块隐藏，不占版面 */
const artists = ref<Artist[]>([])
const keyword = ref('')

/** 正在「加入歌单」弹层里操作的那首；null = 弹层关闭 */
const addTarget = ref<Track | null>(null)

const loading = computed(() => playlistStore.loading)

/** 整库曲目，带搜索过滤 —— 这就是「浏览音乐」的主体 */
const tracks = computed<Track[]>(() => {
  const q = keyword.value.trim()
  return q ? playlistStore.searchTracks(q) : playlistStore.allTracks
})

onMounted(async () => {
  // 曲库走 store（首页已经验证可用）；/list 只下一次，store 有缓存
  if (playlistStore.allTracks.length === 0) await playlistStore.fetchPlaylists()

  try {
    artists.value = playlistStore.artistCache.length
      ? playlistStore.artistCache
      : await fetchArtists()
    playlistStore.artistCache = artists.value
  } catch {
    // 艺人拉不到不影响浏览曲库，静默即可
  }
})

/** 点击即把当前（过滤后的）列表作为队列播放 */
function play(track: Track) {
  const list = tracks.value
  const index = list.findIndex((t) => t.id === track.id)
  if (index < 0) return
  playerStore.setQueue([...list], index)
  playerStore.isPlaying = true
}

function isCurrent(track: Track) {
  return playerStore.currentTrack?.id === track.id
}
</script>

<template>
  <main class="browse">
    <h1 class="browse__title">浏览音乐</h1>

    <!-- 艺人：没有数据就整块不渲染，别用一块「暂无艺人数据」占着首屏 -->
    <section v-if="artists.length > 0" class="browse__section">
      <h2 class="browse__section-title">艺人（{{ artists.length }}）</h2>
      <ArtistList :artists="artists" :loading="false" />
    </section>

    <section class="browse__section">
      <div class="browse__bar">
        <h2 class="browse__section-title">全部曲目（{{ tracks.length }}）</h2>
        <input
          v-model="keyword"
          class="browse__search"
          type="search"
          placeholder="搜索歌名 / 歌手"
        />
      </div>

      <p v-if="loading" class="browse__hint">正在加载音乐库…</p>
      <p v-else-if="tracks.length === 0" class="browse__hint">
        {{ keyword.trim() ? '没有匹配的曲目' : '音乐库为空' }}
      </p>

      <div v-else class="browse__list">
        <div
          v-for="(track, i) in tracks"
          :key="track.id"
          class="browse__row"
          :class="{ 'browse__row--playing': isCurrent(track) }"
          @click="play(track)"
        >
          <span class="browse__row-num">{{ isCurrent(track) ? '♪' : i + 1 }}</span>
          <span class="browse__row-title">{{ track.title }}</span>
          <span class="browse__row-artist">{{ track.artist }}</span>
          <span class="browse__row-album">{{ track.album || track.folder || '—' }}</span>
          <span class="browse__row-dur">
            {{ track.duration ? formatTime(track.duration) : '--:--' }}
          </span>
          <span class="browse__row-add">
            <button
              class="browse__row-add-btn"
              title="加入歌单"
              aria-label="加入歌单"
              @click.stop="addTarget = track"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 000-7.8z" />
              </svg>
            </button>
          </span>
        </div>
      </div>
    </section>
    <!-- 「加入歌单」弹层：点任意一行的心形按钮打开 -->
    <AddToPlaylistModal :track="addTarget" @close="addTarget = null" />
  </main>
</template>

<style scoped>
.browse {
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

.browse__title {
  font-size: 1.5rem;
  font-weight: 700;
  margin-bottom: var(--spacing-lg);
}

.browse__section {
  margin-bottom: var(--spacing-xl);
}

.browse__section-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: var(--spacing-sm);
}

.browse__bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--spacing-md);
  flex-wrap: wrap;
}

.browse__search {
  flex: 1;
  min-width: 140px;
  max-width: 260px;
  height: 30px;
  padding: 0 12px;
  font-size: 0.8rem;
  color: var(--text-primary);
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  outline: none;
}

.browse__search:focus {
  border-color: var(--color-primary);
}

.browse__hint {
  padding: var(--spacing-lg) 0;
  font-size: 0.85rem;
  color: var(--text-tertiary);
}

/* 曲目行：与主页列表保持同一套列宽节奏（# / 歌名 / 歌手 / 专辑 / 时长） */
.browse__row {
  display: flex;
  align-items: center;
  height: 38px;
  font-size: 0.82rem;
  color: var(--text-primary);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.browse__row:hover {
  background: var(--bg-tertiary);
}

.browse__row--playing {
  background: var(--bg-tertiary);
  font-weight: 600;
}

.browse__row--playing .browse__row-num {
  color: var(--color-primary);
}

.browse__row-num {
  width: 34px;
  flex-shrink: 0;
  text-align: center;
  font-size: 0.75rem;
  color: var(--text-tertiary);
}

.browse__row-title {
  flex: 1;
  min-width: 0;
  padding-right: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browse__row-artist {
  width: 160px;
  flex-shrink: 0;
  padding-right: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browse__row-album {
  width: 180px;
  flex-shrink: 0;
  padding-right: 12px;
  color: var(--text-tertiary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.browse__row-dur {
  width: 52px;
  flex-shrink: 0;
  text-align: right;
  color: var(--text-tertiary);
  font-variant-numeric: tabular-nums;
}

/* 「加入歌单」列 */
.browse__row-add {
  width: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.browse__row-add-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  color: var(--text-faint);
  background: none;
  border: none;
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.browse__row-add-btn:hover {
  color: var(--color-primary);
  background: var(--bg-elevated);
  transform: scale(1.15);
}

@media (max-width: 900px) {
  .browse__row-album {
    display: none;
  }
}

@media (max-width: 639px) {
  .browse__row-artist {
    width: 90px;
  }
  .browse__search {
    max-width: none;
  }
}
</style>
