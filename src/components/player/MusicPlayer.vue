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

onMounted(() => {
  if (!playerContainer.value) return

  ap = new APlayer({
    container: playerContainer.value,
    ...APLAYER_CONFIG
  })

  playerStore.initPlayer(ap)

  // ─── APlayer → Store（同步播放器状态到 Store）───

  ap.on('play', () => { playerStore.isPlaying = true })
  ap.on('pause', () => { playerStore.isPlaying = false })

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
 * 关键修复：ap.list.clear() 内部会触发 APlayer 的 pause 事件，
 * 导致 store.isPlaying 被错误覆盖为 false。
 * 解决方法：在 clear() 之前保存 isPlaying，add() 之后恢复。
 */
let _queuedPlaying = false

watch(
  () => playerStore.queue,
  (tracks) => {
    if (!ap) return
    _queuedPlaying = playerStore.isPlaying
    ap.list.clear()
    if (tracks.length > 0) {
      const audioList = tracks.map((t) => ({
        name: t.title,
        artist: t.artist,
        url: t.url,
        cover: t.cover || '',
        type: 'hls'
      }))
      ap.list.add(audioList)
      // add() 已在内部 switch 到第 0 首，恢复播放状态
      if (_queuedPlaying) {
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

// 监听当前索引（用户通过 next/prev 主动切换时）
let _switchingIndex = false
watch(
  () => playerStore.currentIndex,
  (index) => {
    if (!ap || _switchingIndex) return
    _switchingIndex = true
    ap.list.switch(index)
    _switchingIndex = false
    if (playerStore.isPlaying) {
      nextTick(() => ap?.play())
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

.music-player :deep(.aplayer-lrc) {
  display: none;
}
</style>
