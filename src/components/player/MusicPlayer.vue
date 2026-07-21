<script setup lang="ts">
import { ref, onMounted, watch, onUnmounted, nextTick } from 'vue'
import { usePlayerStore } from '@/stores/player'
import APlayer from 'aplayer'
import 'aplayer/dist/APlayer.min.css'
import type { PlayMode } from '@/types'

const playerStore = usePlayerStore()

/** APlayer 容器 DOM 引用 */
const playerContainer = ref<HTMLDivElement>()

/** Hls 实例引用（用于销毁） */
let hlsInstance: any = null

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
 * 初始化 HLS：检测 .m3u8 URL，创建 Hls.js 实例挂载到 audio 元素。
 * Safari 原生支持 HLS，跳过 hls.js。
 * HLS 就绪后如果 store 要求播放，自动恢复播放。
 */
function setupHls(audio: HTMLAudioElement, url: string) {
  // 销毁旧实例
  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }

  if (!url.endsWith('.m3u8')) return

  // Safari 原生支持 HLS
  if (audio.canPlayType('application/vnd.apple.mpegurl')) {
    audio.src = url
    return
  }

  // 动态导入 hls.js（code splitting）
  import('hls.js').then(({ default: Hls }) => {
    if (Hls.isSupported()) {
      hlsInstance = new Hls()
      hlsInstance.loadSource(url)
      hlsInstance.attachMedia(audio)

      // HLS manifest 加载完毕后，如果 store 标记为播放中则恢复播放
      hlsInstance.on('hlsManifestParsed', () => {
        if (playerStore.isPlaying && audio.paused) {
          audio.play().catch(() => {
            // 浏览器自动播放策略拦截，静默
          })
        }
      })
    }
  })
}

/**
 * 获取 APlayer 内部的 audio 元素。
 * APlayer 的 DOM 结构：container > .aplayer-body > .aplayer-info > .aplayer-music
 * audio 元素在 container 下直接作为兄弟
 */
function getAudioElement(): HTMLAudioElement | null {
  if (!playerContainer.value) return null
  return playerContainer.value.querySelector('audio')
}

// ===== 生命周期 =====

let ap: any = null

onMounted(() => {
  if (!playerContainer.value) return

  // 创建 APlayer 实例
  ap = new APlayer({
    container: playerContainer.value,
    ...APLAYER_CONFIG
  })

  // 注册到 store
  playerStore.initPlayer(ap)

  // --- APlayer 事件 → store ---

  ap.on('play', () => { playerStore.isPlaying = true })
  ap.on('pause', () => { playerStore.isPlaying = false })

  ap.on('timeupdate', () => {
    if (ap?.audio) {
      playerStore.updateTime(ap.audio.currentTime)
    }
  })

  ap.on('ended', () => {
    playerStore.next()
  })

  // 曲目切换事件 → 获取时长信息
  // APlayer 已内置 HLS 支持（通过 type: 'hls'），不再需要自定义 setupHls
  ap.on('listswitch', () => {
    nextTick(() => {
      setTimeout(() => {
        const audio = getAudioElement()
        const current = playerStore.currentTrack
        if (audio && current) {
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

// --- store → APlayer ---

// 监听播放队列（immediate 确保挂载时已有队列也能加载）
watch(
  () => playerStore.queue,
  (tracks) => {
    if (!ap) return
    // 重建 APlayer 列表
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
      ap.list.switch(playerStore.currentIndex)
    }
  },
  { deep: true, immediate: true }
)

// 监听当前索引
watch(
  () => playerStore.currentIndex,
  (index) => {
    if (ap) {
      ap.list.switch(index)
    }
  },
  { immediate: true }
)

// 监听播放/暂停
watch(
  () => playerStore.isPlaying,
  (playing) => {
    if (ap) {
      playing ? ap.play() : ap.pause()
    }
  },
  { immediate: true }
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
  if (hlsInstance) {
    hlsInstance.destroy()
    hlsInstance = null
  }
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
  /* APlayer 由外部容器控制尺寸，此处只确保不溢出 */
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

.music-player :deep(.aplayer-lrc) {
  display: none;
}
</style>
