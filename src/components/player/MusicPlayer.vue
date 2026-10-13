<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { usePlayerStore } from '@/stores/player'
import APlayer from 'aplayer'
import 'aplayer/dist/APlayer.min.css'
import Hls from 'hls.js'
import { registerPlugin } from '@capacitor/core'
import type { PlayMode, Track } from '@/types'

// ===== 安卓壳：后台播放不中断 =====

/** 本地插件（android/app/src/main/java/.../PlaybackPlugin.java），无需 npm 安装 */
interface PlaybackForegroundPlugin {
  start(): Promise<{ ok?: boolean; note?: string }>
  stop(): Promise<void>
  ping(): Promise<{ bridge?: string; playing?: boolean; serviceRunning?: boolean }>
  /** 推当前曲目给原生 —— 锁屏 / 通知栏媒体卡片显示的就是这份数据 */
  updateNowPlaying(o: {
    title: string
    artist: string
    album: string
    playing: boolean
    /** 封面，**绝对 URL**（原生要下载它，相对路径下不了） */
    cover: string
    /** 当前歌词行。空串 = 没歌词，原生那边会落回显示歌手 */
    lyric: string
  }): Promise<void>
}
const PlaybackForeground = registerPlugin<PlaybackForegroundPlugin>('PlaybackForeground')

/**
 * 让 App 进入 / 退出「前台态」。
 *
 * 为什么需要：App 退到后台后，音频本身还能继续播（媒体管线在浏览器进程里），
 * 但**安卓会冻结 WebView 的 JS 执行** —— 而「一首放完自动切下一首」是靠 JS
 * 处理 audio 的 ended 事件完成的，JS 冻住就永远不切（表现为"后台只能播一首"）。
 * 前台服务把进程钉在前台态，JS 才继续跑。
 *
 * 浏览器里 isNativePlatform() 为 false，直接跳过，**网页完全不受影响**。
 */
function setForegroundPlaying(on: boolean) {
  // ⚠️ 这里**刻意不用** `if (!Capacitor.isNativePlatform()) return` 预判。
  //
  // 壳子模式（server.url 加载远程页面）下 isNativePlatform() 会返回 false，
  // 那一行会让整条原生路径被静默跳过 —— 插件没被调用、前台服务没起、
  // 原生 playing 标志没置位、onPause 没跳过 super、WebView 被暂停……
  // 症状就是「通知栏空白 + 后台一首放完不切歌」，两个问题同一个根因。
  //
  // 改成直接调：浏览器里插件不存在，promise 会 reject，按下面的规则安静处理。
  const p = on ? PlaybackForeground.start() : PlaybackForeground.stop()

  p.then((r) => {
    if (!on) {
      playerStore.foregroundNote = '已停止（未在播放）'
      return
    }
    // 这一行是"通知栏为什么是空的"唯一线索，别吞
    playerStore.foregroundNote = r?.ok
      ? '前台服务已启动，通知栏应有常驻通知'
      : `前台服务启动失败：${r?.note ?? '未知原因'}`
  }).catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e)
    // 纯网页里必然是这个错（插件没实现），不该当成问题展示给用户
    if (!/not implemented|not available|not found/i.test(msg)) {
      playerStore.foregroundNote = `插件调用失败：${msg}`
    }
  })
}

// APlayer 内部通过全局 `Hls` 变量引用 hls.js，需要显式挂载
;(window as any).Hls = Hls

// 国内到 Cloudflare 的单连接吞吐低且抖动，调优 hls.js 默认参数：
// 尽早预取首个分片、收紧缓冲目标、加大重试，减少"卡住不出声"
Hls.DefaultConfig.startFragPrefetch = true
Hls.DefaultConfig.maxBufferLength = 20
Hls.DefaultConfig.maxMaxBufferLength = 40
Hls.DefaultConfig.fragLoadingMaxRetry = 6
Hls.DefaultConfig.fragLoadingRetryDelay = 500
Hls.DefaultConfig.manifestLoadingMaxRetry = 4

const playerStore = usePlayerStore()

/** APlayer 容器 DOM 引用 */
const playerContainer = ref<HTMLDivElement>()

// ===== APlayer 配置 =====
const APLAYER_CONFIG = {
  autoplay: false,
  theme: '#ff5e5e',
  loop: 'all' as const,
  order: 'list' as const,
  preload: 'auto' as const,
  volume: 0.7,
  mutex: true,
  lrcType: 3,
  listFolded: true,
  listMaxHeight: '250px',
  audio: [] as any[]
}

/**
 * 获取 APlayer 内部的 audio 元素
 */
function getAudioElement(): HTMLAudioElement | null {
  if (!playerContainer.value) return null
  return playerContainer.value.querySelector('audio')
}

// ===== 锁屏 / 通知栏媒体控制（Media Session API）=====
//
// 纯 Web API，浏览器和安卓壳同时受益：
//   网页端 —— 手机浏览器锁屏、系统媒体中心能看到歌名歌手并能控制上一首/下一首/暂停
//   安卓壳 —— Capacitor 的 WebView 走同一套，直接接进系统媒体通知
//
// 所以这一步**不依赖 Capacitor**，是整条 APK 路线里性价比最高的一步。

/**
 * 封面地址。
 *
 * ⚠️ 必须是**绝对 URL** —— 相对路径系统取不到图，原生侧也下载不了。
 *
 * ⚠️ 用的是**锁屏专用**封面 /PIC/cover.jpg（640×640 / 94 KB），
 *    和 App 界面里那张转盘图 /PIC/disc-default.jpg 是**两张不同的图**，别混：
 *    HomeView 的转盘仍走 disc-default，本文件只负责系统媒体中心那张。
 */
function coverUrlOf(track: Track): string {
  return new URL(track.cover || '/PIC/cover.jpg', location.origin).href
}

/**
 * 把曲目 / 封面 / 歌词 / 播放状态推给原生 —— 锁屏与通知栏媒体卡片的数据源。
 *
 * 单独抽出来是因为**歌词行每几秒就换一次**：那条路只需要重推这一份，
 * 不必连带把浏览器侧的 mediaSession 也重建一遍。
 */
function pushNowPlaying() {
  const track = playerStore.currentTrack
  if (!track) return

  // 当前歌词行（-1 / 越界时是 undefined，安全）
  const line = playerStore.lyricLines[playerStore.lyricIndex]

  // 诊断：把"这一句到底有没有推出去"摆到 ⓘ 里。
  // 之前"锁屏没歌词"分不清两种情况 —— 三星不认那个字段，还是数据压根没送到原生。
  // 有这一行，下次测试就能直接定性，而不是再赌一轮。
  playerStore.foregroundNote = line
    ? `锁屏歌词：第 ${playerStore.lyricIndex + 1}/${playerStore.lyricLines.length} 行「${line.text}」`
    : `锁屏歌词：无（本首歌词数据 ${playerStore.lyricLines.length} 行）`

  PlaybackForeground.updateNowPlaying({
    title: track.title,
    artist: track.artist,
    album: track.album || track.folder || '',
    playing: playerStore.isPlaying,
    cover: coverUrlOf(track),
    lyric: line?.text ?? ''
  }).catch(() => {
    // 纯浏览器里插件不存在，必然 reject —— 这是预期，安静吞掉
  })
}

/**
 * 把当前曲目与播放状态同步给系统媒体中心。
 *
 * ⚠️ 这里有**两条独立的路**，别并成一条：
 *   ① 原生壳（安卓）—— 推给 PlaybackService，喂锁屏 / 通知栏的媒体卡片。
 *      它**不能**走 navigator.mediaSession：WebView 里的 mediaSession 不会注册到
 *      系统（这正是当初"锁屏没控件"的原因）。
 *   ② 手机 / 桌面浏览器 —— 走 navigator.mediaSession，浏览器自己接进系统媒体中心。
 */
function syncMediaSession() {
  // ① 原生侧。放在最前，且**不受下面 mediaSession 可用性影响** ——
  //    两条路服务的是不同目标，不该因为浏览器不支持 mediaSession 就连带掐掉原生那条。
  pushNowPlaying()

  // ② 网页侧
  if (!('mediaSession' in navigator)) return
  const track = playerStore.currentTrack
  if (!track) {
    navigator.mediaSession.metadata = null
    return
  }

  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist,
    album: track.album || track.folder || '',
    artwork: [{ src: coverUrlOf(track), sizes: '640x640', type: 'image/jpeg' }]
  })
  navigator.mediaSession.playbackState = playerStore.isPlaying ? 'playing' : 'paused'
}

// 歌词行进到下一句 → 只重推原生那份（锁屏卡片第二行显示的就是它）。
// lyricIndex 由 currentTime 算出，watch 只在**行真的变了**时触发，不会跟着 timeupdate 抖。
watch(() => playerStore.lyricIndex, () => pushNowPlaying())

/** 注册锁屏上的那几个控制按钮 */
function initMediaSession() {
  if (!('mediaSession' in navigator)) return
  const ms = navigator.mediaSession

  // store 只有 togglePlay()，所以这里各自加个状态判断，
  // 免得系统发 play 时我们反而把正在播的暂停了
  ms.setActionHandler('play', () => {
    if (!playerStore.isPlaying) playerStore.togglePlay()
  })
  ms.setActionHandler('pause', () => {
    if (playerStore.isPlaying) playerStore.togglePlay()
  })
  ms.setActionHandler('previoustrack', () => playerStore.prev())
  ms.setActionHandler('nexttrack', () => playerStore.next())
  ms.setActionHandler('seekto', (d: MediaSessionActionDetails) => {
    if (typeof d.seekTime === 'number') playerStore.seek(d.seekTime)
  })
}

// ===== 生命周期 =====

let ap: any = null
let _ignorePause = false  // 队列重建时忽略 APlayer 的 pause 事件

onMounted(() => {
  if (!playerContainer.value) return

  ap = new APlayer({
    container: playerContainer.value,
    ...APLAYER_CONFIG
  })

  playerStore.initPlayer(ap)

  // ─── APlayer → Store（同步播放器状态到 Store）───

  ap.on('play', () => {
    playerStore.isPlaying = true
    // ⚠️ 顺序不能换：先起服务，再同步曲目。
    // 反过来 updateNowPlaying 会赶在服务 onCreate 之前到（那边 instance 还是 null），
    // 那一次推送被丢弃 —— 表现为「锁屏卡片要等到下次切歌才有歌名」。
    setForegroundPlaying(true)
    syncMediaSession()
  })

  ap.on('pause', () => {
    // 队列重建或 next/prev 切换期间忽略 pause，防止闪烁
    if (_ignorePause || playerStore.ignorePause) return
    playerStore.isPlaying = false
    syncMediaSession()
    // ⚠️ 这里【刻意不】停前台服务。暂停 ≠ 结束。
    //
    // 原来 pause 就 stop()，结果 APlayer 在**自动切歌的瞬间**也会触发一次 pause
    // → 服务被拆掉、通知消失、前台态丢失 → WebView 的 JS 又被冻住。
    // 症状：解锁屏幕后通知不见了，而且又不能自动切歌了（两个症状同一个根因）。
    //
    // 真实音乐 App 也是暂停后通知继续在（可续播），所以服务只在这两种时候停：
    // 组件卸载（见 onUnmounted）、或用户在界面里显式停止。
    // 代价：暂停后挂在后台的服务会一直留着，安卓内存吃紧时可能提示，可接受。
  })

  ap.on('timeupdate', () => {
    if (ap?.audio) {
      playerStore.updateTime(ap.audio.currentTime)
      if (ap.audio.duration && isFinite(ap.audio.duration)) {
        playerStore.updateDuration(ap.audio.duration)
      }
    }
  })

  ap.on('ended', () => {
    if (ap) {
      playerStore.currentIndex = ap.list.index
    }
  })

  // 曲目切换时：同步索引 + 自动继续播放 + 更新时长
  //
  // ⚠️ 索引只能取事件参数里的 index，不能在回调里读 ap.list.index：
  //    APlayer 的 list.switch() 是「先 trigger('listswitch', {index})，后 this.index = index」，
  //    回调执行时 ap.list.index 还是【旧】值 —— 用它会把 store.currentIndex 回滚成上一首。
  //    症状：声音切了，但底栏歌名 / 右侧面板歌名 / 歌词全部停在旧歌；next 要点两次才生效
  //    （第一次切了声音但 currentIndex 被回滚，next 又算出同一个目标索引）。
  ap.on('listswitch', (e: { index?: number } = {}) => {
    if (typeof e.index === 'number') {
      playerStore.currentIndex = e.index
    } else if (ap) {
      playerStore.currentIndex = ap.list.index
    }
    // APlayer 没有倍速 API，切歌后得把当前倍速重新贴到 audio 上
    if (ap?.audio) ap.audio.playbackRate = playerStore.playbackRate
    // 切歌后同步媒体中心 —— 索引刚更新过，这里读到的是新曲目
    syncMediaSession()
    nextTick(() => {
      // 自动播放（处理 next/prev 场景：切换后继续播放）
      setTimeout(() => {
        if (playerStore.isPlaying && ap) {
          ap.play().catch(() => {
            // HLS 可能还未就绪，重试一次
            setTimeout(() => {
              if (playerStore.isPlaying && ap) ap.play().catch(() => {})
            }, 500)
          })
        }
      }, 250)
      // 更新时长
      setTimeout(() => {
        const audio = getAudioElement()
        if (audio) {
          const updateDuration = () => {
            if (audio.duration && isFinite(audio.duration)) {
              playerStore.updateDuration(audio.duration)
            }
          }
          audio.addEventListener('durationchange', updateDuration, { once: true })
          audio.addEventListener('loadedmetadata', updateDuration, { once: true })
        }
      }, 100)
    })
  })

  // 音量变更
  ap.on('volumechange', () => {
    if (ap?.audio) {
      playerStore.muted = ap.audio.muted
    }
  })

  initMediaSession()

  // ─── 原生 → 网页：锁屏 / 通知栏按钮的落点 ───
  //
  // PlaybackService 的 MediaSession.Callback 通过 Bridge.eval 调这里。
  //
  // ⚠️ 必须走 store 的 next() / prev()，**不能**直接改 currentIndex：
  //    只有 list.switch() 才会真的换声音、并触发 listswitch 回写索引；
  //    直接改索引会让 currentTrack 与实际声音脱节（歌名变了但还在放上一首）。
  //    这正是 store 里 next()/prev() 绕那一圈的用意。
  //
  // 放在 MusicPlayer 而不是 main.ts：控件是播放器的事。没有播放器就没有可控制的对象
  // （store 的 next() 也会因 aplayerInstance 为空自行 no-op）。
  ;(window as any).__ymNativeControl = (action: string) => {
    if (action === 'play') {
      // 加状态判断，免得系统发 play 时我们反而把正在播的暂停了
      if (!playerStore.isPlaying) playerStore.togglePlay()
    } else if (action === 'pause') {
      if (playerStore.isPlaying) playerStore.togglePlay()
    } else if (action === 'next') {
      playerStore.next()
    } else if (action === 'prev') {
      playerStore.prev()
    }
  }

  // 页面加载就探一次原生桥，不依赖播放。
  // ⚠️ 这里【不吞】"插件未实现"类错误 —— 那一句正是我们要的答案。
  PlaybackForeground.ping()
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
})

// ─── Store → APlayer（响应 Store 变化控制播放器）───

/**
 * 监听播放队列：重建 APlayer 列表
 */
/** 上一次构建 APlayer 列表时的队列指纹，用来判断「同一队列内切歌」 */
let lastQueueKey = ''

watch(
  () => playerStore.queue,
  (tracks) => {
    if (!ap) return
    const shouldPlay = playerStore.isPlaying
    const targetIdx = playerStore.currentIndex

    // 同一队列内切歌（首页点列表就是这条路径）：只切索引，不重建列表。
    // 原来无脑 clear + add 会把 191 个列表项重建一遍，hls 实例也被连带销毁重来，
    // 白白拖长「点下去到出声」的时间。
    const key = tracks.map((t) => t.id).join('|')
    if (key === lastQueueKey && tracks.length > 0) {
      if (targetIdx >= 0 && targetIdx < tracks.length) {
        _ignorePause = true
        ap.list.switch(targetIdx)
        _ignorePause = false
        // 真正出声由 listswitch 里的重试逻辑兜底，这里失败无所谓
        if (shouldPlay) ap.play().catch(() => {})
      }
      return
    }
    lastQueueKey = key

    _ignorePause = true
    ap.list.clear()
    _ignorePause = false
    if (tracks.length > 0) {
      const audioList = tracks.map((t) => ({
        name: t.title,
        artist: t.artist,
        url: t.url,
        cover: t.cover || '',
        // ⚠️ 只有 hls 才显式给 type：APlayer 收到 `type: 'mp3'` 会【静默不设 src】，
        // 省略 type 时它按 URL 自己判断 —— mp3 走原生 <audio>，m3u8 走 hls.js
        ...(t.type === 'hls' ? { type: 'hls' } : {}),
        // 有歌词文件时交给 APlayer 解析（lrcType: 3 即 URL 形式）
        ...(t.lyricsUrl ? { lrc: t.lyricsUrl } : {})
      }))
      ap.list.add(audioList)
      if (targetIdx >= 0 && targetIdx < tracks.length) {
        ap.list.switch(targetIdx)
      }
      // HLS 初始化后开始播放
      if (shouldPlay) {
        nextTick().then(() => {
          setTimeout(() => {
            if (ap) ap.play().catch(() => {})
          }, 200)
        })
      }
    }
  },
  { deep: true, immediate: true }
)

// 监听播放/暂停
watch(
  () => playerStore.isPlaying,
  (playing) => {
    if (!ap) return
    if (playing) {
      ap.play()
    } else {
      ap.pause()
    }
  }
)

// 监听音量
watch(
  () => playerStore.volume,
  (vol) => {
    if (ap) ap.volume(vol)
  }
)

// 监听播放模式
// APlayer 运行时直接读 options.order / options.loop（实例上没有 order/loop setter），
// 所以必须写 options，写 ap.order 会被忽略。
watch(
  () => playerStore.playMode,
  (mode: PlayMode) => {
    if (!ap) return
    ap.options.order = mode === 'shuffle' ? 'random' : 'list'
    ap.options.loop = mode === 'single-repeat' ? 'one' : 'all'
  }
)

onUnmounted(() => {
  // 撤掉给原生的入口，免得服务回调到一个已销毁的页面上
  delete (window as any).__ymNativeControl
  // 播放器真正没了，这时候才该退出前台态
  setForegroundPlaying(false)
  if (ap) {
    ap.destroy()
    ap = null
  }
})
</script>

<template>
  <div ref="playerContainer" class="music-player" />
</template>

<style scoped>
.music-player {
  width: 100%;
  max-width: 600px;
}

/* APlayer 暗色主题覆盖 */
.music-player :deep(.aplayer) {
  background: var(--bg-secondary) !important;
  color: var(--text-primary) !important;
  font-family: inherit;
}

.music-player :deep(.aplayer-info) {
  border-bottom: 1px solid var(--bg-tertiary) !important;
}

.music-player :deep(.aplayer-title) {
  color: var(--text-primary) !important;
}

.music-player :deep(.aplayer-author) {
  color: var(--text-secondary) !important;
}

.music-player :deep(.aplayer-time) {
  color: var(--text-tertiary) !important;
}

.music-player :deep(.aplayer-bar-wrap .aplayer-bar) {
  background: var(--bg-tertiary) !important;
}

.music-player :deep(.aplayer-bar-wrap .aplayer-bar .aplayer-loaded) {
  background: var(--bg-elevated) !important;
}

.music-player :deep(.aplayer-bar-wrap .aplayer-bar .aplayer-played) {
  background: var(--color-primary) !important;
}

.music-player :deep(.aplayer-volume-bar-wrap .aplayer-volume-bar) {
  background: var(--bg-tertiary) !important;
}

.music-player :deep(.aplayer-volume-bar-wrap .aplayer-volume-bar .aplayer-volume) {
  background: var(--color-primary) !important;
}

.music-player :deep(.aplayer-list) {
  background: var(--bg-secondary) !important;
  border-color: var(--bg-tertiary) !important;
}

.music-player :deep(.aplayer-list li) {
  color: var(--text-secondary) !important;
  border-color: var(--bg-tertiary) !important;
}

.music-player :deep(.aplayer-list li:hover) {
  background: var(--bg-tertiary) !important;
}

.music-player :deep(.aplayer-list li.aplayer-list-light) {
  background: var(--bg-tertiary) !important;
}

.music-player :deep(.aplayer-list li .aplayer-list-index) {
  color: var(--text-tertiary) !important;
}

.music-player :deep(.aplayer-list-cur) {
  background: var(--color-primary) !important;
}

.music-player :deep(.aplayer-button) {
  border-color: rgba(255,255,255,0.8) !important;
}

.music-player :deep(.aplayer-button path) {
  fill: #fff !important;
}

.music-player :deep(.aplayer-bar-wrap) {
  cursor: pointer !important;
}

.music-player :deep(.aplayer-bar) {
  cursor: pointer !important;
}

.music-player :deep(.aplayer-played) {
  cursor: pointer !important;
}

.music-player :deep(.aplayer-thumb) {
  cursor: pointer !important;
  box-shadow: 0 0 4px rgba(0,0,0,0.3) !important;
}

.music-player :deep(.aplayer-thumb:hover) {
  transform: scale(1.2) !important;
}

.music-player :deep(.aplayer-loaded) {
  cursor: pointer !important;
}

.music-player :deep(.aplayer-lrc) {
  display: none;
}
</style>
