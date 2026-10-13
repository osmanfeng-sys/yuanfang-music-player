<script setup lang="ts">
import { onMounted, ref, computed, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { usePlaylistStore } from '@/stores/playlist'
import { usePlayerStore } from '@/stores/player'
import { useUserStore } from '@/stores/user'
import LoadingSpinner from '@/components/common/LoadingSpinner.vue'
import ErrorMessage from '@/components/common/ErrorMessage.vue'
import { formatTime } from '@/utils/format'
import { loadLyrics } from '@/services/lyrics'
import { currentUserId } from '@/utils/userKey'
import { registerPlugin } from '@capacitor/core'

/** 与 MusicPlayer.vue 同一个本地插件；registerPlugin 幂等，两处各注册一次没问题 */
const nativeProbe = registerPlugin<{
  ping(): Promise<{ bridge?: string; playing?: boolean; serviceRunning?: boolean }>
  /** 读本机 APK 的版本号；浏览器里插件不存在 → reject（调用处会吞掉） */
  getAppVersion(): Promise<{ versionCode?: number; versionName?: string }>
  /** 用系统浏览器打开链接。**必须走原生** —— 见 openUpdate() 里的说明 */
  openExternal(o: { url: string }): Promise<void>
}>('PlaybackForeground')
import AddToPlaylistModal from '@/components/playlist/AddToPlaylistModal.vue'
import { prefetchHlsSegments } from '@/services/prefetch'
import type { Track } from '@/types'

const route = useRoute()
const playlistStore = usePlaylistStore()
const playerStore = usePlayerStore()
const userStore = useUserStore()

/** 曲库加载状态直接复用 store，不再在本页维护第二份：原来这里吞掉错误，
 *  /list 一失败就静默显示空列表，既没有报错也没有重试入口 */
const loading = computed(() => playlistStore.loading)
const error = computed(() => playlistStore.error)

/** 主菜单：正在播放 / 乐库 / 搜索 */
const activeTab = ref<'playing' | 'playlist' | 'search'>('playing')

/** 播放列表二级：当前打开的音乐夹 */
const openedFolder = ref<string | null>(null)

/** 搜索关键词 */
const keyword = ref('')

// ===== 客户端更新检查 =====
//
// 只对【原生改动】有意义：壳模式加载的是线上页面，网页改动重开就是最新的，
// 只有 Java / 资源 / 图标 / 版本号变了才需要装新 APK。
//
// 只做「提示 + 点一下跳浏览器下载」。**不申请 REQUEST_INSTALL_PACKAGES、
// 不做应用内安装** —— Android 不允许普通应用静默安装，系统必弹一次确认，
// 与其绕不如把这一下交给系统，反正用户本来就要点。

interface UpdateInfo {
  versionName: string
  url: string
  notes?: string
}

/** 有新版时非空；同时驱动 ⓘ 按钮上的绿点 */
const updateInfo = ref<UpdateInfo | null>(null)

/** 点「下载更新」失败时的原因。显示在弹层里，避免又出现"点了没反应"这种查不了的现象 */
const updateError = ref('')

async function checkUpdate(): Promise<void> {
  try {
    // 本机版本只有原生侧知道。浏览器里没有 APK → 直接不提示
    //（网页端没有"版本"这个概念，提示了也没东西可装）
    const local = await nativeProbe.getAppVersion().catch(() => null)
    if (!local?.versionCode) return

    const res = await fetch('/api/version', { cache: 'no-store' })
    // 404 = 还没有版本清单，是正常状态，不是错误
    if (!res.ok) return

    const v = (await res.json()) as {
      versionCode?: number
      versionName?: string
      url?: string
      notes?: string
    }
    if (typeof v.versionCode !== 'number' || v.versionCode <= local.versionCode) return
    if (!v.url) return

    updateInfo.value = {
      versionName: v.versionName ?? String(v.versionCode),
      url: v.url,
      notes: v.notes
    }
  } catch {
    // 检查更新失败不该打扰用户 —— 静默
  }
}

/**
 * 跳系统浏览器下载。
 *
 * ⚠️ 这里**必须走原生** openExternal，不能用 window.open —— 实测踩过：
 *    壳模式下页面和 APK 是**同源**的（都在 yuanfang-music.pages.dev），
 *    而 Capacitor 的 WebView 只把**站外**链接交给系统浏览器；
 *    同源链接它当成页内跳转，WebView 自己去加载那个 .apk，
 *    加载不了又没有下载监听 → 表现就是"点了完全没反应"。
 *
 *    旁证：OpenShop 那个购物车按钮用同样的 window.open 就好用 ——
 *    因为它指向的是另一个域名。
 *
 * 浏览器里没有这个插件（reject），退回 window.open —— 网页端本来就是正常的。
 */
async function openUpdate() {
  const info = updateInfo.value
  if (!info) return
  const abs = new URL(info.url, location.origin).href
  updateError.value = ''
  try {
    await nativeProbe.openExternal({ url: abs })
  } catch (e: unknown) {
    // 浏览器里必然走到这（插件不存在），这是预期；把原因显示出来，
    // 免得下次又变成"点了没反应"这种没法查的现象
    updateError.value = e instanceof Error ? e.message : String(e)
    window.open(abs, '_blank')
  }
}

/** 弹层 */
const showInfo = ref(false)
const showRatePanel = ref(false)

/** 移动端歌词面板（≤900px 时右侧面板收成全屏浮层，由这个开关控制） */
const showMobileLyrics = ref(false)

/** 欢迎语里显示的名字：登录了显示 ID，没登录显示「嘉宾」 */
const welcomeName = computed(() => currentUserId.value || '嘉宾')

/**
 * OpenShop 商店地址。
 *
 * ⚠️ 这个常量原来叫 PODCAST_URL、按钮 title 写「播客地址」—— **是标错了名字**，
 *    这个域名一直是 OpenShop 的店铺前台（同一个 Worker `yuanfangselect` 同时
 *    提供前台与 /admin），跟播客没关系。2026-10-13 订正。
 */
const SHOP_URL = 'https://yuanfangselect.ccwu.cc/'

/** 播放倍速选项 */
const RATES = [0.5, 0.75, 1, 1.25, 1.5, 2]

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
  // ===== 原生桥探针 =====
  //
  // ⚠️ 必须放在【一定会挂载】的组件里。原来放在 MusicPlayer.vue，而它在
  //    AppFooter 的 `<template v-else>` 中 —— 没有当前曲目时压根不挂载，
  //    于是"不依赖播放的探针"反而变成了必须有曲目才发得出去。
  //    首页是打开就有的，放这里才是真的不依赖播放。
  //
  // 先同步写一句再发请求：这样"连这句都没有"本身就能证明代码没跑到，
  // 而不是被异步吞掉。
  playerStore.foregroundNote = '探针已发出，等待原生响应…'
  nativeProbe
    .ping()
    .then((r) => {
      playerStore.foregroundNote =
        `原生桥连通（bridge=${r?.bridge ?? '?'}，前台服务=${r?.serviceRunning ? '运行中' : '未运行'}）`
    })
    .catch((e: unknown) => {
      const msg = e instanceof Error ? e.message : String(e)
      playerStore.foregroundNote = /not implemented|not available|not found/i.test(msg)
        ? '★ 原生桥未连通：Capacitor 找不到 PlaybackForeground 插件（未注册）'
        : `原生桥调用失败：${msg}`
    })

  // 检查有没有新版 APK。不 await —— 它自己会静默处理失败，
  // 不该拖慢首屏（浏览器里 getAppVersion 直接 reject，等于跳过）
  checkUpdate()

  // 支持 `/?tab=playing|playlist|search` 直接落在指定页签
  // （歌单详情页的「正在播放」按钮靠它跳过来）
  const wanted = route.query.tab
  if (wanted === 'playing' || wanted === 'playlist' || wanted === 'search') {
    activeTab.value = wanted
  }

  await loadMusic()
  seedQueue()
  // 曲目时长后台补（/list 不下发 duration），延迟启动，别跟首屏起播抢带宽
  setTimeout(() => void playlistStore.fillDurations(playlistStore.allTracks), 6000)
  // 起播没成功（曲库为空或加载失败）就落在「播放乐库」，别让首屏是一片空白。
  // ⚠️ 但 URL 明确指定了页签就尊重它 —— 否则「正在播放」那个跳转按钮
  //    在没在播歌时会把用户丢到「播放乐库」，和按钮名字对不上
  if (!route.query.tab && !playerStore.currentTrack) activeTab.value = 'playlist'
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

/** 正在「加入歌单」弹层里操作的那首；null = 弹层关闭 */
const addTarget = ref<Track | null>(null)

// ===== 列头排序 =====

type SortKey = 'title' | 'artist' | 'album' | 'duration'

const sortKey = ref<SortKey | null>(null)
const sortAsc = ref(true)

/** 点同列表头切换升降序，点其它列则从升序开始 */
function toggleSort(key: SortKey) {
  if (sortKey.value === key) {
    sortAsc.value = !sortAsc.value
  } else {
    sortKey.value = key
    sortAsc.value = true
  }
}

function sortArrow(key: SortKey) {
  if (sortKey.value !== key) return '⇅'
  return sortAsc.value ? '▲' : '▼'
}

/**
 * 排序只作用于**展示层**，不改动 store 里的数据。
 * 中英文混排用 localeCompare('zh-Hans-CN')，否则中文按 Unicode 码位排会乱。
 * 时长缺值时当 0，排到最前（升序）。
 */
function sortList(list: Track[]): Track[] {
  const key = sortKey.value
  if (!key) return list
  const dir = sortAsc.value ? 1 : -1
  const pick = (t: Track): string =>
    key === 'album' ? albumOf(t) : key === 'artist' ? t.artist : t.title

  return [...list].sort((a, b) => {
    if (key === 'duration') return ((a.duration ?? 0) - (b.duration ?? 0)) * dir
    return pick(a).localeCompare(pick(b), 'zh-Hans-CN') * dir
  })
}

const sortedQueue = computed(() => sortList(queue.value))
const sortedFolderTracks = computed(() => sortList(openedTracks.value))
const sortedSearch = computed(() => sortList(searchResults.value))

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

function setRate(r: number) {
  playerStore.setPlaybackRate(r)
  showRatePanel.value = false
}

function openShop() {
  // 地址是常量、恒有值，原来那个「待定」分支已经没有意义，去掉
  window.open(SHOP_URL, '_blank')
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
    <!-- 欢迎语：整页正中央浮层。**无条件渲染** —— 未登录时显示「嘉宾」，
         这样新装/未登录状态下也能看到这块动效，不至于像功能坏了。
         容器 pointer-events:none —— 浮在内容之上但不抢点击，
         否则正中间那几行曲目就点不动了。
         文字复制一份做无缝循环滚动（动画位移 -50% 正好等于一份的宽度）。 -->
    <div class="home__welcome">
      <div class="home__welcome-track">
        <span class="home__welcome-text">
          欢迎 <b class="home__welcome-id">{{ welcomeName }}</b> 聆听
        </span>
        <span class="home__welcome-text" aria-hidden="true">
          欢迎 <b class="home__welcome-id">{{ welcomeName }}</b> 聆听
        </span>
      </div>
    </div>

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
        >乐库</span>
        <span
          class="home__tab"
          :class="{ 'home__tab--active': activeTab === 'search' }"
          @click="activeTab = 'search'"
        >搜索</span>

        <!-- 歌单入口：桌面端顶栏导航已有，移动端顶栏那块被隐藏了，所以在这里补一个 -->
        <router-link to="/playlists" class="home__tab home__tab--nav">歌单</router-link>

        <span class="home__bar-spacer" />

        <!-- OpenShop 商店入口。图标是位图（OpenShop 的购物车），其余按钮都是
             stroke SVG —— 位图按高度对齐即可，见 .home__icon-img -->
        <button class="home__icon-btn" title="OpenShop" @click="openShop">
          <img src="/ICO/shop-icon.png" alt="" class="home__icon-img" />
        </button>

        <button
          class="home__icon-btn"
          :class="{ 'home__icon-btn--dot': !!updateInfo }"
          :title="updateInfo ? `有新版本 v${updateInfo.versionName}` : '播放器说明'"
          @click="showInfo = true"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 11v5M12 8h.01" />
          </svg>
        </button>

        <!-- 背景设置那个小齿轮已移除：它一直没真正生效（详见设置页「外观」里的说明），
             入口搬到设置页去了 -->

        <!-- 歌词面板开关：仅移动端显示（桌面端右侧面板常驻） -->
        <button
          class="home__icon-btn home__lyric-btn"
          :class="{ 'home__icon-btn--on': showMobileLyrics }"
          title="歌词"
          @click="showMobileLyrics = !showMobileLyrics"
        ><span class="home__lyric-glyph">词</span></button>

        <!-- 播放倍速：原生 <select> 的弹出层由系统渲染，手机上会铺满全屏且样式不可控，
             改成自绘按钮 + 窄列表浮层，宽度与按钮一致、贴着控件下方展开（放在最右，浮层 right 对齐它） -->
        <button
          class="home__icon-btn home__rate-btn"
          :class="{ 'home__icon-btn--on': showRatePanel }"
          title="播放速度"
          @click="showRatePanel = !showRatePanel"
        >{{ playerStore.playbackRate }}x</button>

        <!-- 倍速浮层 -->
        <div v-if="showRatePanel" class="home__rate-panel">
          <button
            v-for="r in RATES"
            :key="r"
            class="home__bg-option"
            :class="{ 'home__bg-option--on': playerStore.playbackRate === r }"
            @click="setRate(r)"
          >{{ r }} x</button>
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

        <!-- 列头：复用行内类名，保证与数据行严格对齐。
             四列等宽（等距排列）；点表头排序，再点一次反向 -->
        <div v-if="showListHead" class="home__head">
          <span class="home__row-num">#</span>
          <button
            class="home__row-title home__head-btn"
            :class="{ 'home__head-btn--on': sortKey === 'title' }"
            @click="toggleSort('title')"
          >歌名<span class="home__head-arrow">{{ sortArrow('title') }}</span></button>
          <button
            class="home__row-artist home__head-btn"
            :class="{ 'home__head-btn--on': sortKey === 'artist' }"
            @click="toggleSort('artist')"
          >歌手<span class="home__head-arrow">{{ sortArrow('artist') }}</span></button>
          <button
            class="home__row-album home__head-btn"
            :class="{ 'home__head-btn--on': sortKey === 'album' }"
            @click="toggleSort('album')"
          >专辑<span class="home__head-arrow">{{ sortArrow('album') }}</span></button>
          <button
            class="home__row-dur home__head-btn"
            :class="{ 'home__head-btn--on': sortKey === 'duration' }"
            @click="toggleSort('duration')"
          >时长<span class="home__head-arrow">{{ sortArrow('duration') }}</span></button>
          <!-- 每行的「加入歌单」列，表头只放个心形做标识 -->
          <span class="home__row-add">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20.8 4.6a5.5 5.5 0 00-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 00-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 000-7.8z" />
            </svg>
          </span>
        </div>

        <!-- 正在播放 -->
        <!-- 注意：这里必须是 v-if，不能接上面列头的 v-if 成 v-else-if 链——
             否则表头一显示（有队列时必然显示），整个列表就被跳过，表现为「只有表头，没有歌」 -->
        <template v-if="activeTab === 'playing'">
          <p v-if="queue.length === 0" class="home__empty">当前没有播放队列，去「播放乐库」挑一首吧</p>
          <div
            v-for="(track, idx) in sortedQueue"
            :key="track.id"
            class="home__row"
            :class="{ 'home__row--playing': currentId === track.id }"
            @click="playFrom(sortedQueue, track)"
          >
            <span class="home__row-num">{{ currentId === track.id ? '♪' : idx + 1 }}</span>
            <span class="home__row-title">{{ track.title }}</span>
            <span class="home__row-artist">{{ track.artist }}</span>
            <span class="home__row-album">{{ albumOf(track) }}</span>
            <span class="home__row-dur">{{ track.duration ? formatTime(track.duration) : '--:--' }}</span>
            <span class="home__row-add">
              <button
                class="home__row-add-btn"
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
              v-for="(track, idx) in sortedFolderTracks"
              :key="track.id"
              class="home__row"
              :class="{ 'home__row--playing': currentId === track.id }"
              @click="playFrom(sortedFolderTracks, track)"
            >
              <span class="home__row-num">{{ currentId === track.id ? '♪' : idx + 1 }}</span>
              <span class="home__row-title">{{ track.title }}</span>
              <span class="home__row-artist">{{ track.artist }}</span>
              <span class="home__row-album">{{ albumOf(track) }}</span>
              <span class="home__row-dur">{{ track.duration ? formatTime(track.duration) : '--:--' }}</span>
              <span class="home__row-add">
                <button
                  class="home__row-add-btn"
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
            v-for="(track, idx) in sortedSearch"
            :key="track.id"
            class="home__row"
            :class="{ 'home__row--playing': currentId === track.id }"
            @click="playFrom(sortedSearch, track)"
          >
            <span class="home__row-num">{{ currentId === track.id ? '♪' : idx + 1 }}</span>
            <span class="home__row-title">{{ track.title }}</span>
            <span class="home__row-artist">{{ track.artist }}</span>
            <span class="home__row-album">{{ albumOf(track) }}</span>
            <span class="home__row-dur">{{ track.duration ? formatTime(track.duration) : '--:--' }}</span>
            <span class="home__row-add">
              <button
                class="home__row-add-btn"
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
        </template>
      </div>
    </section>

    <!-- ===== 右：播放面板（歌名 / CD / 歌词） =====
         桌面端常驻右侧；≤900px 时变成盖住主区的全屏浮层，由顶栏「歌词」按钮开关 -->
    <aside class="home__player" :class="{ 'home__player--open': showMobileLyrics }">
      <button class="home__player-close" title="关闭" @click="showMobileLyrics = false">✕</button>
      <p class="home__song-name">{{ playerStore.currentTrack?.title ?? '未在播放' }}</p>

      <div class="home__disc-wrap">
        <div class="home__disc" :class="{ 'home__disc--spin': playerStore.isPlaying }">
          <img
            :src="playerStore.currentTrack?.cover || '/PIC/disc-default.jpg'"
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
          <!-- 有新版时置顶。点一下交给系统浏览器下载，装的时候系统还会再确认一次 -->
          <p v-if="updateInfo" class="home__modal-update">
            <b>发现新版本 v{{ updateInfo.versionName }}</b>
            <button class="home__update-btn" @click="openUpdate">下载更新</button>
            <span v-if="updateInfo.notes" class="home__update-notes">{{ updateInfo.notes }}</span>
            <span v-if="updateError" class="home__update-notes">打开失败：{{ updateError }}</span>
          </p>
          <p><b>远方音乐播放器</b> — 自建在线音乐库，音频存放在 Cloudflare R2，按需拉取。</p>
          <p><b>正在播放 / 乐库 / 搜索</b>：三个页签。<b>乐库</b>按音乐夹（R2 一级目录）分组，点进去看该夹全部曲目，点任意一首即以该夹为队列播放；只有直接放在存储桶根目录、不属于任何音乐夹的才归为「未分类」。<b>搜索</b>按歌名或歌手实时过滤全库。</p>
          <p><b>歌单</b>：顶栏「歌单」进入。任意列表行末尾的心形按钮可以把歌加进歌单；歌单详情页的「从曲库添加」支持两级目录点选 + 多选。</p>
          <p><b>歌单同步</b>：在「设置」里填一组自定的「用户 ID + 密码」，歌单就存到云端并归属这个身份，换设备填同样的 ID 和密码即可取回。没填时歌单只存在本机。</p>
          <p><b>OpenShop</b>：右上角的购物车图标，打开配套的商店站点。</p>
          <p><b>播放速度</b>：右上角可切 0.5x ~ 2.0x，适合跟唱练习。</p>
          <p><b>歌词</b>：按歌名 + 歌手自动在线匹配，歌词面板逐行高亮跟随；匹配不到会显示「暂无歌词」。</p>
          <p><b>底部控制条</b>：拖动进度条跳转，音量条直接拖；快退/快进 15 秒、上一首/下一首、循环·单曲·随机都在这一条上。</p>
          <p><b>自动播放</b>：首次进入会用曲目最多的艺人歌单填充队列并尝试播放；若浏览器拦截了自动播放，点一下播放键即可。</p>
          <p><b>安卓 App</b>：切后台或锁屏后继续播放、并能自动切下一首；锁屏与通知栏有媒体卡片，显示封面与歌名，第二行跟随显示当前歌词；支持上一首 / 播放暂停 / 下一首，蓝牙耳机与车机的按键同样可用。</p>
          <p><b>背景</b>：移到「设置 → 外观」里了（该功能尚未做完，详见设置页说明）。</p>
          <!-- 安卓壳后台播放的诊断信息：服务起不来时通知栏是空的，
               没有这行就分不清「功能没生效」还是「起来了但通知不显眼」。
               浏览器里恒为空、不显示。 -->
          <p v-if="playerStore.foregroundNote" class="home__modal-note">
            后台播放：{{ playerStore.foregroundNote }}
          </p>
          <p class="home__modal-note">音频来自 Cloudflare R2（mp3 直传，支持拖动进度），首次播放会有短暂缓冲。</p>
        </div>
      </div>
    </div>
    <!-- 「加入歌单」弹层：点任意一行的心形按钮打开 -->
    <AddToPlaylistModal :track="addTarget" @close="addTarget = null" />
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
  --rate-w: 54px;              /* 倍速按钮与浮层共用的宽度，保证两者严格对齐 */
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

/* 歌单入口：只在移动端出现（桌面端顶栏导航里已经有了，不重复放两个） */
.home__tab--nav {
  display: none;
}

.home__bar-spacer {
  flex: 1;
}

.home__icon-btn {
  /* 给 --dot 那个 ::after 圆点当定位基准 */
  position: relative;
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

/* 位图图标（OpenShop 商店按钮那个购物车）。其余图标都是 15px 的 stroke SVG，
   这里按高度对齐；宽度自适应 —— 这张是横构图，压成正方形会变形 */
.home__icon-img {
  height: 15px;
  width: auto;
  display: block;
}

/* 有新版本时 ⓘ 按钮右上角的绿点（和顶栏未登录提示同一个绿） */
.home__icon-btn--dot::after {
  content: '';
  position: absolute;
  top: 2px;
  right: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #4ade80;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.45);
}

/* 说明弹层里的更新提示行 */
.home__modal-update {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 10px;
  margin-bottom: 10px;
  border-radius: 6px;
  background: rgba(74, 222, 128, 0.12);
  border: 1px solid rgba(74, 222, 128, 0.45);
}

.home__update-btn {
  padding: 3px 12px;
  font-size: 12px;
  color: #0b1f12;
  background: #4ade80;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.home__update-notes {
  flex-basis: 100%;
  font-size: 11px;
  color: var(--text-tertiary);
}

.home__icon-btn:hover,
.home__icon-btn--on {
  background: var(--accent);
}

/* 倍速按钮：宽度固定，浮层照抄这个宽度 */
.home__rate-btn {
  width: var(--rate-w);
  padding: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

/* 歌词开关：仅移动端。用汉字「词」比图标好认 */
.home__lyric-btn {
  display: none;
}

.home__lyric-glyph {
  font-size: 13px;
  line-height: 1;
  font-weight: 600;
}

/* 倍速浮层：贴着倍速按钮下方、同宽的窄列表，不再铺满屏幕 */
.home__rate-panel {
  position: absolute;
  right: 10px;
  top: 44px;
  width: var(--rate-w);
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px;
  background: rgba(20, 20, 20, 0.92);
  backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  z-index: 20;
}

.home__rate-panel .home__bg-option {
  padding: 5px 0;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

/* 浮层里的选项按钮。类名还叫 bg-option 是历史遗留 ——
   背景设置搬去设置页后这里只剩倍速在用，但改名要连模板一起动，先留着 */
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

/* ===== 欢迎语：整页正中央，胶囊镂空底 + 内部文字循环滚动 =====
   ⚠️ 刻意【不写】@media (prefers-reduced-motion: reduce) { animation: none }。
      上一版加过，结果 Windows 开了「减少动画」时浏览器直接停掉动画，
      只剩两份静止的重复文字，看着像坏了。这是用户明确要的动效，不让系统关掉它。 */
.home__welcome {
  /* ⚠️ 必须用 fixed 而不是 absolute：
     要对齐的是【顶栏】那条水平线，而 .home 位于 .layout__content 内，
     那个容器的 top 本来就是「顶栏高度 + 8px」—— absolute 够不着顶栏。 */
  position: fixed;
  top: calc(var(--topbar-height) / 2); /* 与「首页 / 歌单 / 浏览」同一水平线 */
  left: 50%; /* 水平位置：保持页面正中不变 */
  transform: translate(-50%, -50%);
  /* 固定窄宽 + 圆角 + 半透明底 = 胶囊形"镂空"窗口。
     宽度必须比一份文字窄，否则文字塞得下就不会滚（短 ID 时尤其明显） */
  width: 168px;
  height: 28px;
  display: flex;
  align-items: center;
  overflow: hidden;
  border-radius: var(--radius-full);
  background: rgba(0, 0, 0, 0.45);
  border: 1px solid rgba(212, 175, 55, 0.4);
  box-shadow: inset 0 1px 6px rgba(0, 0, 0, 0.45);
  /* 浮在内容之上，但不抢点击 */
  pointer-events: none;
  z-index: 5;
}

.home__welcome-track {
  display: flex;
  white-space: nowrap;
  /* 位移 -50% = 一份文字的宽度（含留白），两份首尾相接 → 无缝循环 */
  animation: home-welcome-scroll 9s linear infinite;
  will-change: transform;
}

@keyframes home-welcome-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

.home__welcome-text {
  font-family: 'Microsoft YaHei', '微软雅黑', 'PingFang SC', sans-serif;
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0.5px;
  color: #d4af37; /* 金色：固定文案 */
  filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.6));
  padding: 0 1rem 0 0.75rem; /* 左留进入余量，右留两份之间的间隔 */
}

/* 账号名单独配色 */
.home__welcome-id {
  color: #ff8fc7; /* 粉色 */
  font-weight: 600;
}

/* 列头：复用行内类名，保证列头与数据行严格对齐 */
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

/* 表头按钮：点一次升序，再点一次降序 */
.home__head-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0;
  font: inherit;
  color: inherit;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
}

.home__head-btn:hover {
  color: var(--text-secondary);
}

.home__head-btn--on {
  color: var(--color-primary) !important;
}

.home__head-arrow {
  font-size: 9px;
  opacity: 0.75;
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

/* 歌名 / 歌手 / 专辑 / 时长 —— 四列等宽（等距排列）。
   尺寸共用一套：表头与数据行复用同一批类名，宽度不一致就对不齐了。
   原来分别是 flex:1 / 200px / 240px / 52px，间距不均匀。 */
.home__row-title,
.home__row-artist,
.home__row-album,
.home__row-dur {
  flex: 1 1 0;
  min-width: 0;
  padding-right: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.home__row-artist {
  color: var(--text-dim);
}

.home__row-album {
  color: var(--text-faint);
}

.home__row-dur {
  color: var(--text-faint);
  font-variant-numeric: tabular-nums;
}

/* 「加入歌单」列：窄固定宽。表头只放个心形做标识，行内是可点的按钮。
   不做 hover 才显形 —— 触摸屏没有 hover，那样等于没这个功能 */
.home__row-add {
  width: 32px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-faint);
}

.home__row-add-btn {
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

.home__row-add-btn:hover {
  color: var(--color-primary);
  background: var(--bg-elevated);
  transform: scale(1.15);
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

/* 移动端浮层的关闭按钮，桌面端不需要 */
.home__player-close {
  display: none;
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
  /* ⚠️ 必须定位：跟随滚动用 el.offsetTop 算偏移，而 offsetTop 是相对 offsetParent 的。
     这里不加 position，offsetParent 就落到外层 .home__player（移动端还是 fixed），
     offsetTop 会白白多出「歌名+唱片+歌手」那 ~240px，滚出来永远停在当前句下方 8~9 行。 */
  position: relative;
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
  /* 收成贴合文字的宽度再居中：底纹才能只包住这一句，而不是横贯整个面板 */
  width: fit-content;
  max-width: 100%;
  margin: 0 auto;
  padding: 2px 10px;
  border-radius: 6px;
  transition: color var(--transition-fast), background var(--transition-fast);
}

/* 当前播放行：绿色底纹 */
.home__lyric-line--active {
  color: #fff;
  font-weight: 600;
  background: rgba(46, 204, 113, 0.28);
  text-shadow: 0 0 12px rgba(46, 204, 113, 0.55);
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

/* ===== 移动端：右侧面板改成歌词浮层，再依次收起专辑列 → 歌手列 ===== */
@media (max-width: 900px) {
  /* 面板不再是常驻列，而是盖住主区的浮层：几何与 .layout__content 完全一致，
     顶部导航和底部播放控制都还露着，不用退出去就能暂停/切歌 */
  .home__player {
    position: fixed;
    /* 上沿跟着顶栏的【真实下沿】走（--header-bottom 定义在 variables.css :root）。
       不用 --topbar-height：顶栏内容是在「--topbar-height + 安全区」的框里垂直
       居中的，再叠上 --header-drop，实际下沿比 --topbar-height 低约 20px
       —— 只按 --topbar-height 排，这张深色背景的上沿就会压住标题文字和图标。
       这样以后改顶栏高度 / 安全区 / 下移量，这里自动跟着走，不必再手调。 */
    top: calc(var(--header-bottom) + var(--spacing-sm));
    left: var(--page-gutter);
    right: var(--page-gutter);
    bottom: calc(var(--playerbar-height) + 12px);
    z-index: 50;
    width: auto;
    display: none;
    padding: var(--spacing-md);
    background: rgba(16, 16, 18, 0.94);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
  }

  .home__player--open {
    display: flex;
  }

  .home__player-close {
    display: flex;
    align-items: center;
    justify-content: center;
    position: absolute;
    top: 8px;
    right: 8px;
    width: 28px;
    height: 28px;
    border: none;
    border-radius: 4px;
    color: #fff;
    background: var(--glass-bg-strong);
    cursor: pointer;
  }

  .home__lyric-btn {
    display: flex;
  }

  /* 移动端顶栏导航被隐藏了，把「歌单」补到选项卡右边。
     同时选项卡要瘦身 —— 从 3 个变 4 个，不缩小就会挤爆行宽 */
  .home__tab--nav {
    display: inline-block;
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
  /* 窄屏要挤下 4 个页签（正在播放/乐库/搜索/歌单）+ 4 个按钮 + 倍速。
     360px 宽的机器上：页签约 140 + 按钮 96 + 倍速 44 + 间距 24 ≈ 304px，放得下 */
  .home__bar {
    --rate-w: 44px;
    gap: 2px;
    padding: 0 6px;
  }
  .home__tab {
    padding: 3px 5px;
    font-size: 10px;
  }
  .home__icon-btn {
    width: 22px;
    height: 22px;
    margin-left: 2px;
  }
  /* 必须排在 .home__icon-btn 之后：同优先级，靠源序把 24px 覆盖回浮层宽度 */
  .home__rate-btn {
    width: var(--rate-w);
    font-size: 11px;
  }
}
</style>
