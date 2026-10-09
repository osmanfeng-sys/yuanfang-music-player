<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick } from 'vue'
import { usePlaylistStore } from '@/stores/playlist'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ErrorMessage from '@/components/common/ErrorMessage.vue'
import { formatTime } from '@/utils/format'
import { loadLyrics } from '@/services/lyrics'
import { prefetchHlsSegments } from '@/services/prefetch'
import type { Track } from '@/types'

const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()
const userStore = useUserStore()

/** 曲库加载状态直接复用 store，不再在本页维护第二份：原来这里吞掉错误，
 *  /list 一失败就静默显示空列表，既没有报错也没有重试入口 */
const loading = computed(() => playlistStore.loading)
const error = computed(() => playlistStore.error)

/** 主菜单：正在播放 / 播放列表 / 歌曲搜索 */
const activeTab = ref<'playing' | 'playlist' | 'search'>('playing')

/** 播放列表二级：当前打开的音乐夹 */
const openedFolder = ref<string | null>(null)

/** 搜索关键词 */
const keyword = ref('')

/** 弹层 */
const showInfo = ref(false)
const showBgPanel = ref(false)

/** 播客地址 */
const PODCAST_URL = 'https://yuanfangselect.ccwu.cc/'

/** 播放倍速选项 */
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

/** 背景模式选项 */
const BG_MODES: { key: 'wallpaper' | 'cover' | 'black'; label: string }[] = [
  { key: 'wallpaper', label: '默认壁纸' },
  { key: 'cover', label: '封面模糊' },
  { key: 'black', label: '纯黑' }
]

async function loadMusic() {
  // 曲库已缓存就直接用：原来每次进入首页都重下 60KB 的 /list，
  // 从艺人页 playTrack() 跳回首页时还会跟刚起播的 HLS 分片抢带宽
  if (playlistStore.allTracks.length > 0) return
  await playlistStore.fetchPlaylists()
}

/**
 * 首屏没有队列时，用曲目最多的艺人的歌单填充队列并起播第一首。
 *
 * 浏览器自动播放策略：没有用户手势时（首次访问、硬刷新）play() 会被拒绝。
 * 1.2s 后音频仍是暂停就把 isPlaying 改回 false，免得按钮显示成「暂停中」
 * 而实际没在放，让人以为卡住了。
 */
function seedQueue() {
  if (playerStore.queue.length > 0) return
  const tracks = playlistStore.artists[0]?.tracks
  if (!tracks?.length) return

  playerStore.setQueue(tracks, 0)
  playerStore.isPlaying = true

  setTimeout(() => {
    const audio = playerStore.aplayerInstance?.audio as HTMLAudioElement | undefined
    if (audio?.paused) playerStore.isPlaying = false
  }, 1200)
}

onMounted(async () => {
  await loadMusic()
  seedQueue()
  // 曲目时长后台补（/list 不下发 duration），延迟启动，别跟首屏起播抢带宽
  setTimeout(() => void playlistStore.fillDurations(playlistStore.allTracks), 6000)
  // 起播没成功（曲库为空或加载失败）就落在「播放列表」，别让首屏是一片空白
  if (!playerStore.currentTrack) activeTab.value = 'playlist'
})

// ===== 数据 =====

const folders = computed(() => playlistStore.folders)
const queue = computed(() => playerStore.queue)
const currentId = computed(() => playerStore.currentTrack?.id ?? null)

/** 音乐夹内的曲目 */
const openedTracks = computed(
  () => folders.value.find((f) => f.name === openedFolder.value)?.tracks ?? []
)

/** 搜索结果 */
const searchResults = computed(() =>
  keyword.value.trim() ? playlistStore.searchTracks(keyword.value) : []
)

/** 专辑列：Track.album 目前未从 Worker 下发，回退到音乐夹名（去掉 "01_" 序号前缀） */
function albumOf(t: Track): string {
  return t.album || t.folder?.replace(/^\d+[_-]/, '') || '—'
}

/** 当前列表条数（音乐夹一级列表不算曲目列表，不显示列头） */
const listCount = computed(() => {
  if (activeTab.value === 'playing') return queue.value.length
  if (activeTab.value === 'playlist') {
    return openedFolder.value === null ? 0 : openedTracks.value.length
  }
  return searchResults.value.length
})

const showListHead = computed(() => !loading.value && !error.value && listCount.value > 0)

// ===== 播放 =====

function playFrom(list: Track[], track: Track) {
  const idx = list.findIndex((t) => t.id === track.id)
  if (idx === -1) return
  userStore.addToHistory(track.id)
  playerStore.setQueue([...list], idx)
  playerStore.isPlaying = true
  // 预取延后 5 秒再开始：国内链路带宽有限，点击后立刻预取会和 hls.js 抢首片，
  // 反而把「点下去到出声」拖得更久。等首片播出来再补后面的分片。
  setTimeout(() => void prefetchHlsSegments(track.url), 5000)
}

function onRateChange(e: Event) {
  playerStore.setPlaybackRate(Number((e.target as HTMLSelectElement).value))
}

function openPodcast() {
  if (PODCAST_URL) window.open(PODCAST_URL, '_blank')
  else window.alert('播客地址待定')
}

function toggleFolder(name: string) {
  openedFolder.value = openedFolder.value === name ? null : name
}

// ===== 歌词：本地缓存 → 云端 → 在线匹配（lrclib）=====

const lyricLoading = ref(false)

watch(
  () => playerStore.currentTrack?.id,
  async (id) => {
    playerStore.setLyricLines([])
    if (!id) return
    const track = playlistStore.getTrackById(id)
    if (!track) return
    lyricLoading.value = true
    try {
      const lines = await loadLyrics(track)
      // 加载期间可能已切歌，避免覆盖新歌歌词
      if (playerStore.currentTrack?.id === id) playerStore.setLyricLines(lines)
    } finally {
      lyricLoading.value = false
    }
  },
  { immediate: true }
)

// ===== 歌词跟随滚动 =====

const lyricBox = ref<HTMLElement>()

watch(
  () => playerStore.lyricIndex,
  async (i) => {
    if (i < 0) return
    await nextTick()
    const box = lyricBox.value
    const el = box?.children[i] as HTMLElement | undefined
    if (box && el) {
      box.scrollTo({
        top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2,
        behavior: 'smooth'
      })
    }
  }
)
</script>

<template>
  <main class="home">
    <!-- ===== 左：主区 ===== -->
    <section class="home__main">
      <!-- 顶部按钮条 -->
      <div class="home__bar">
        <span
          class="home__tab"
          :class="{ 'home__tab--active': activeTab === 'playing' }"
          @click="activeTab = 'playing'"
        >正在播放</span>
        <span
          class="home__tab"
          :class="{ 'home__tab--active': activeTab === 'playlist' }"
          @click="activeTab = 'playlist'"
        >播放列表</span>
        <span
          class="home__tab"
          :class="{ 'home__tab--active': activeTab === 'search' }"
          @click="activeTab = 'search'"
        >歌曲搜索</span>

        <span class="home__bar-spacer" />

        <button class="home__icon-btn" title="播客地址（待定）" @click="openPodcast">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <rect x="9" y="2" width="6" height="11" rx="3" />
            <path d="M5 10a7 7 0 0014 0M12 17v4M8 21h8" />
          </svg>
        </button>

        <button class="home__icon-btn" title="播放器说明" @click="showInfo = true">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
        </button>

        <button
          class="home__icon-btn"
          :class="{ 'home__icon-btn--on': showBgPanel }"
          title="背景设置"
          @click="showBgPanel = !showBgPanel"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06A1.65 1.65 0 003.68 15a1.65 1.65 0 00-1.51-1H2a2 2 0 110-4h.09A1.65 1.65 0 003.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06A1.65 1.65 0 009 3.68 1.65 1.65 0 0010 2.17V2a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06A1.65 1.65 0 0019.4 9c.14.35.44.6.82.7H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>

        <select
          class="home__rate"
          :value="playerStore.playbackRate"
          title="播放速度"
          @change="onRateChange"
        >
          <option v-for="r in RATES" :key="r" :value="r">{{ r }} x</option>
        </select>

        <!-- 背景设置浮层 -->
        <div v-if="showBgPanel" class="home__bg-panel">
          <button
            v-for="m in BG_MODES"
            :key="m.key"
            class="home__bg-option"
            :class="{ 'home__bg-option--on': userStore.bgMode === m.key }"
            @click="userStore.setBgMode(m.key)"
          >{{ m.label }}</button>
        </div>
      </div>

      <!-- 内容区 -->
      <div class="home__body">
        <LoadingSpinner v-if="loading" size="lg" text="正在加载音乐库..." />
        <ErrorMessage
          v-else-if="error"
          :message="error"
          :retryable="true"
          @retry="loadMusic"
        />

        <!-- 列头：复用行内类名，保证三列对齐 -->
        <div v-if="showListHead" class="home__head">
          <span class="home__row-num">#</span>
          <span class="home__row-title">歌名</span>
          <span class="home__row-artist">歌手</span>
          <span class="home__row-album">专辑</span>
          <span class="home__row-dur">时长</span>
        </div>

        <!-- 正在播放 -->
        <!-- 注意：这里必须是 v-if，不能接上面列头的 v-if 成 v-else-if 链——
             否则表头一显示（有队列时必然显示），整个列表就被跳过，表现为「只有表头，没有歌」 -->
        <template v-if="activeTab === 'playing'">
          <p v-if="queue.length === 0" class="home__empty">当前没有播放队列，去「播放列表」挑一首吧</p>
          <div
            v-for="(track, idx) in queue"
            :key="track.id"
            class="home__row"
            :class="{ 'home__row--playing': currentId === track.id }"
            @click="playFrom(queue, track)"
          >
            <span class="home__row-num">{{ currentId === track.id ? '♪' : idx + 1 }}</span>
            <span class="home__row-title">{{ track.title }}</span>
            <span class="home__row-artist">{{ track.artist }}</span>
            <span class="home__row-album">{{ albumOf(track) }}</span>
            <span class="home__row-dur">{{ track.duration ? formatTime(track.duration) : '--:--' }}</span>
          </div>
        </template>

        <!-- 播放列表（音乐夹 → 二级曲目） -->
        <template v-else-if="activeTab === 'playlist'">
          <template v-if="openedFolder === null">
            <p v-if="folders.length === 0" class="home__empty">没有找到音乐夹</p>
            <div
              v-for="f in folders"
              :key="f.name"
              class="home__row home__row--folder"
              @click="toggleFolder(f.name)"
            >
              <span class="home__row-num">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
              </span>
              <span class="home__row-title">{{ f.name }}</span>
              <span class="home__row-artist">{{ f.tracks.length }} 首</span>
              <span class="home__row-dur">›</span>
            </div>
          </template>

          <template v-else>
            <div class="home__crumb" @click="openedFolder = null">
              ‹ 返回音乐夹列表
            </div>
            <div
              v-for="(track, idx) in openedTracks"
              :key="track.id"
              class="home__row"
              :class="{ 'home__row--playing': currentId === track.id }"
              @click="playFrom(openedTracks, track)"
            >
              <span class="home__row-num">{{ currentId === track.id ? '♪' : idx + 1 }}</span>
              <span class="home__row-title">{{ track.title }}</span>
              <span class="home__row-artist">{{ track.artist }}</span>
              <span class="home__row-album">{{ albumOf(track) }}</span>
              <span class="home__row-dur">{{ track.duration ? formatTime(track.duration) : '--:--' }}</span>
            </div>
          </template>
        </template>

        <!-- 歌曲搜索 -->
        <template v-else>
          <div class="home__search">
            <input
              v-model="keyword"
              class="home__search-input"
              type="search"
              placeholder="搜索歌曲名 / 歌手"
            />
            <span class="home__search-count">
              {{ keyword.trim() ? `${searchResults.length} 条结果` : '' }}
            </span>
          </div>
          <p v-if="keyword.trim() && searchResults.length === 0" class="home__empty">没有匹配的歌曲</p>
          <div
            v-for="(track, idx) in searchResults"
            :key="track.id"
            class="home__row"
            :class="{ 'home__row--playing': currentId === track.id }"
            @click="playFrom(searchResults, track)"
          >
            <span class="home__row-num">{{ currentId === track.id ? '♪' : idx + 1 }}</span>
            <span class="home__row-title">{{ track.title }}</span>
            <span class="home__row-artist">{{ track.artist }}</span>
            <span class="home__row-album">{{ albumOf(track) }}</span>
            <span class="home__row-dur">{{ track.duration ? formatTime(track.duration) : '--:--' }}</span>
          </div>
        </template>
      </div>
    </section>

    <!-- ===== 右：播放面板（歌名 / CD / 歌词） ===== -->
    <aside class="home__player">
      <p class="home__song-name">{{ playerStore.currentTrack?.title ?? '未在播放' }}</p>

      <div class="home__disc-wrap">
        <div class="home__disc" :class="{ 'home__disc--spin': playerStore.isPlaying }">
          <img
            :src="playerStore.currentTrack?.cover || '/PIC/disc-default.svg'"
            alt=""
            class="home__disc-img"
          />
        </div>
      </div>

      <p class="home__song-artist">
        {{ playerStore.currentTrack?.artist ?? '从列表选择歌曲' }}
      </p>

      <div ref="lyricBox" class="home__lyric">
        <p v-if="lyricLoading" class="home__lyric-empty">歌词加载中…</p>
        <p v-else-if="playerStore.lyricLines.length === 0" class="home__lyric-empty">暂无歌词</p>
        <template v-else>
          <p
            v-for="(line, i) in playerStore.lyricLines"
            :key="i"
            class="home__lyric-line"
            :class="{ 'home__lyric-line--active': i === playerStore.lyricIndex }"
          >{{ line.text }}</p>
        </template>
      </div>
    </aside>

    <!-- ===== 说明弹层 ===== -->
    <div v-if="showInfo" class="home__modal" @click.self="showInfo = false">
      <div class="home__modal-panel">
        <div class="home__modal-head">
          <span>播放器说明</span>
          <button class="home__icon-btn" @click="showInfo = false">✕</button>
        </div>
        <div class="home__modal-body">
          <p><b>远方音乐播放器</b> — 基于 HLS 流媒体的在线音乐库。</p>
          <p><b>正在播放</b>：显示当前播放队列，点击任意曲目直接切歌。</p>
          <p><b>播放列表</b>：按音乐夹（专辑目录）分组，点进去可看到该夹全部曲目；点击曲目即以该夹为队列开始播放。</p>
          <p><b>歌曲搜索</b>：按歌名或歌手名实时过滤整个音乐库。</p>
          <p><b>播放速度</b>：右侧下拉菜单可切换 0.5x ~ 2.0x，适合听播客或跟唱练习。</p>
          <p><b>背景设置</b>：齿轮按钮可切换「默认壁纸 / 封面模糊 / 纯黑」三种背景。</p>
          <p><b>自动播放</b>：首次进入会用曲目最多的艺人歌单填充队列并尝试播放；若浏览器拦截了自动播放，点一下播放键即可。</p>
          <p><b>快捷键</b>：拖动底部进度条可跳转，音量条直接拖动调节；上下首、循环/单曲/随机在底部控制条。</p>
          <p class="home__modal-note">音频来自 Cloudflare R2，按需切片（HLS），首次播放会有短暂缓冲。</p>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.home {
  position: relative;
  display: flex;
  gap: var(--spacing-md);
  height: 100%;
}

/* ===== 左侧主区 ===== */
.home__main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  background: var(--glass-bg);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-radius);
  overflow: hidden;
}

/* 顶部按钮条 */
.home__bar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  height: 48px;
  padding: 0 10px;
  flex-shrink: 0;
  border-radius: var(--panel-radius) var(--panel-radius) 0 0;
  background: linear-gradient(to right, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0.01) 100%);
}

.home__tab {
  padding: 4px 20px;
  font-size: 12px;
  border-radius: 4px;
  color: #fff;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(2px);
  cursor: pointer;
  user-select: none;
  transition: background var(--transition-fast);
}

.home__tab:hover {
  background: rgba(255, 255, 255, 0.3);
}

.home__tab--active {
  background: var(--accent);
}

.home__bar-spacer {
  flex: 1;
}

.home__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  margin-left: 4px;
  border: none;
  border-radius: 4px;
  color: #fff;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(2px);
  cursor: pointer;
  transition: background var(--transition-fast);
}

.home__icon-btn:hover,
.home__icon-btn--on {
  background: var(--accent);
}

.home__rate {
  height: 26px;
  margin-left: 4px;
  padding: 0 6px;
  font-size: 12px;
  color: #fff;
  background: var(--glass-bg-strong);
  border: none;
  border-radius: 4px;
  outline: none;
  cursor: pointer;
}

.home__rate option {
  color: #000;
}

/* 背景设置浮层 */
.home__bg-panel {
  position: absolute;
  right: 10px;
  top: 44px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: rgba(20, 20, 20, 0.8);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  z-index: 20;
}

.home__bg-option {
  padding: 5px 16px;
  font-size: 12px;
  text-align: left;
  color: #fff;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.home__bg-option:hover {
  background: var(--glass-bg-hover);
}

.home__bg-option--on {
  background: var(--accent);
}

/* 内容区 */
.home__body {
  flex: 1;
  overflow-y: auto;
  padding: 0 10px 10px;
  scrollbar-width: thin;
}

.home__crumb {
  padding: 8px 10px;
  font-size: 12px;
  color: var(--accent);
  cursor: pointer;
  user-select: none;
}

/* 列头：复用行内类名，保证「歌名 / 歌手 / 专辑」三列与行严格对齐 */
.home__head {
  display: flex;
  align-items: center;
  height: 30px;
  font-size: 11px;
  color: var(--text-faint);
  user-select: none;
}

.home__head .home__row-artist,
.home__head .home__row-album,
.home__head .home__row-dur {
  color: var(--text-faint);
}

.home__row {
  display: flex;
  align-items: center;
  height: 40px;
  font-size: 12px;
  color: #fff;
  border-radius: 8px;
  cursor: pointer;
  transition: background var(--transition-fast);
}

.home__row:hover {
  background-image: linear-gradient(to right, rgba(255, 255, 255, 0.1) 0%, rgba(255, 255, 255, 0) 100%);
  backdrop-filter: blur(6px);
}

.home__row--playing {
  background-image: linear-gradient(to right, rgba(255, 94, 94, 0.28) 0%, rgba(255, 255, 255, 0) 100%);
  backdrop-filter: blur(6px);
  font-weight: 600;
}

.home__row--folder .home__row-title {
  font-weight: 600;
}

.home__row-num {
  width: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-faint);
}

.home__row--playing .home__row-num {
  color: var(--accent);
}

.home__row-title {
  flex: 1;
  min-width: 0;
  padding-right: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.home__row-artist {
  width: 200px;
  flex-shrink: 0;
  padding-right: 12px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.home__row-album {
  width: 240px;
  flex-shrink: 0;
  padding-right: 12px;
  color: var(--text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.home__row-dur {
  width: 52px;
  flex-shrink: 0;
  text-align: right;
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

.home__empty {
  padding: 40px 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-faint);
}

/* 搜索 */
.home__search {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  padding: 4px 0 12px;
}

.home__search-input {
  flex: 1;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  color: #fff;
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-full);
  outline: none;
}

.home__search-input::placeholder {
  color: var(--text-faint);
}

.home__search-count {
  font-size: 12px;
  color: var(--text-faint);
  white-space: nowrap;
}

/* ===== 右侧播放面板 ===== */
.home__player {
  width: 340px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: var(--spacing-lg) var(--spacing-md);
  background: linear-gradient(to top, rgba(255, 255, 255, 0) 0%, rgba(255, 255, 255, 0.03) 50%, rgba(255, 255, 255, 0) 100%);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-radius);
  overflow: hidden;
}

.home__song-name {
  width: 100%;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 1px;
  text-align: center;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.home__disc-wrap {
  margin: var(--spacing-md) 0 var(--spacing-sm);
  flex-shrink: 0;
}

.home__disc {
  width: 150px;
  height: 150px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 12px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.2), 0 0 24px rgba(0, 0, 0, 0.35);
  color: rgba(255, 255, 255, 0.6);
  background: radial-gradient(circle, rgba(255, 255, 255, 0.08) 0%, rgba(0, 0, 0, 0.35) 70%);
  /* 动画常挂，用 play-state 控制：暂停时停在当前角度而非跳回 0 */
  animation: disc-spin 20s linear infinite;
  animation-play-state: paused;
}

.home__disc--spin {
  animation-play-state: running;
}

.home__disc-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

@keyframes disc-spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.home__song-artist {
  font-size: 12px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  flex-shrink: 0;
}

/* 歌词 */
.home__lyric {
  flex: 1;
  width: 100%;
  margin-top: var(--spacing-md);
  overflow-y: auto;
  text-align: center;
  font-size: 13px;
  line-height: 26px;
  color: rgba(225, 225, 225, 0.7);
  scrollbar-width: none;
  scroll-behavior: smooth;
}

.home__lyric::-webkit-scrollbar {
  display: none;
}

.home__lyric-line {
  padding: 0 6px;
  transition: color var(--transition-fast);
}

.home__lyric-line--active {
  color: #fff;
  font-weight: 600;
  text-shadow: 0 0 12px rgba(255, 94, 94, 0.6);
}

.home__lyric-empty {
  padding: 24px 0;
  font-size: 12px;
  color: var(--text-faint);
}

/* ===== 说明弹层 ===== */
.home__modal {
  position: fixed;
  inset: 0;
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.6);
}

.home__modal-panel {
  width: min(560px, 90vw);
  max-height: 76vh;
  display: flex;
  flex-direction: column;
  background: rgba(20, 20, 20, 0.85);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: var(--panel-radius);
  overflow: hidden;
}

.home__modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px var(--spacing-md);
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid var(--glass-border);
}

.home__modal-body {
  padding: var(--spacing-md);
  overflow-y: auto;
  font-size: 12px;
  line-height: 2;
  color: rgba(255, 255, 255, 0.85);
}

.home__modal-note {
  margin-top: var(--spacing-sm);
  color: var(--text-faint);
}

/* ===== 移动端：先收右侧面板，再依次收起专辑列 → 歌手列 ===== */
@media (max-width: 900px) {
  .home__player {
    display: none;
  }
  .home__row-album {
    display: none;
  }
  .home__row-artist {
    width: 140px;
  }
}

@media (max-width: 639px) {
  .home__row-artist {
    display: none;
  }
  .home__tab {
    padding: 4px 12px;
  }
}
</style>
