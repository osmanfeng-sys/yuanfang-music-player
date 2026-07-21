<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { usePlayerStore } from '@/stores/player'
import APlayer from 'aplayer'
import 'aplayer/dist/APlayer.min.css'
import Hls from 'hls.js'
import type { PlayMode } from '@/types'

// APlayer 内部通过全局 `Hls` 变量引用 hls.js，需要显式挂载
;(window as any).Hls = Hls

const playerStore = usePlayerStore()

/** APlayer 容器 DOM 引用 */
const playerContainer = ref<HTMLDivElement>()

// ===== APlayer 配置 =====
const APLAYER_CONFIG = {
  autoplay: false,
  theme: '#1DB954',
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

  ap.on('play', () => { playerStore.isPlaying = true })

  ap.on('pause', () => {
    // 队列重建期间 APlayer 内部会触发 pause，不覆盖 store 状态
    if (_ignorePause) return
    playerStore.isPlaying = false
  })

  ap.on('timeupdate', () => {
    if (ap?.audio) {
      playerStore.updateTime(ap.audio.currentTime)
    }
  })

  // APlayer 已内置 ended → auto-next（loop: 'all'），
  // 我们只需同步 currentIndex 让 Store 知道当前是第几首
  ap.on('ended', () => {
    if (ap) {
      playerStore.currentIndex = ap.list.index
    }
  })

  // 曲目切换时：同步索引 + 更新时长
  ap.on('listswitch', () => {
    if (ap) {
      playerStore.currentIndex = ap.list.index
    }
    nextTick(() => {
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
})

// ─── Store → APlayer（响应 Store 变化控制播放器）───

/**
 * 监听播放队列：重建 APlayer 列表
 * clear() 内部会触发 APlayer 的 pause 事件，
 * 用 _ignorePause 防止它覆盖 store.isPlaying
 */
watch(
  () => playerStore.queue,
  (tracks) => {
    if (!ap) return
    const wasPlaying = playerStore.isPlaying
    _ignorePause = true
    ap.list.clear()
    _ignorePause = false
    if (tracks.length > 0) {
      const audioList = tracks.map((t) => ({
        name: t.title,
        artist: t.artist,
        url: t.url,
        cover: t.cover || '',
        type: 'hls'
      }))
      ap.list.add(audioList)
      if (wasPlaying) {
        ap.play()
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

// 监听播放模式（映射到 APlayer 的 order）
watch(
  () => playerStore.playMode,
  (mode: PlayMode) => {
    if (!ap) return
    if (mode === 'shuffle') {
      ap.order = 'random'
    } else {
      ap.order = 'list'
    }
  }
)

onUnmounted(() => {
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

/* 封面播放按钮颜色修正 */
.music-player :deep(.aplayer-button) {
  border-color: rgba(255,255,255,0.8) !important;
}

.music-player :deep(.aplayer-button path) {
  fill: #fff !important;
}

/* 进度条可拖动区域 */
.music-player :deep(.aplayer-bar-wrap) {
  cursor: pointer !important;
}

.music-player :deep(.aplayer-bar) {
  cursor: pointer !important;
}

.music-player :deep(.aplayer-played) {
  cursor: pointer !important;
}

/* 进度条拖动手柄 */
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
