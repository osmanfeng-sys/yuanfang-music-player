import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Track, PlayMode } from '@/types'

export const usePlayerStore = defineStore('player', () => {
  // ===== State =====

  /** 当前播放队列（有序） */
  const queue = ref<Track[]>([])
  /** 当前播放索引（指向 queue） */
  const currentIndex = ref(0)

  /** 播放状态 */
  const isPlaying = ref(false)
  /** 当前播放时间（秒） */
  const currentTime = ref(0)
  /** 总时长（秒） */
  const duration = ref(0)
  /** 音量 0-1 */
  const volume = ref(0.7)
  /** 是否静音 */
  const muted = ref(false)

  /** 播放模式 */
  const playMode = ref<PlayMode>('list-repeat')

  /** APlayer 实例（由 MusicPlayer 组件挂载后设置） */
  const aplayerInstance = ref<any>(null)

  // ===== Getters =====

  /** 当前播放曲目 */
  const currentTrack = computed<Track | null>(() => {
    if (queue.value.length === 0) return null
    return queue.value[currentIndex.value] ?? null
  })

  const queueLength = computed(() => queue.value.length)

  /** 播放进度 0-1 */
  const progress = computed(() => {
    if (duration.value === 0) return 0
    return currentTime.value / duration.value
  })

  const isLastTrack = computed(() => currentIndex.value >= queue.value.length - 1)
  const isFirstTrack = computed(() => currentIndex.value <= 0)

  // ===== Actions =====

  /** 挂载 APlayer 实例引用 */
  function initPlayer(instance: any) {
    aplayerInstance.value = instance
  }

  /** 设置播放队列 */
  function setQueue(tracks: Track[], startIndex = 0) {
    queue.value = tracks
    currentIndex.value = startIndex
  }

  /** 播放指定索引 */
  function play(index: number) {
    currentIndex.value = index
    isPlaying.value = true
  }

  /** 按曲目 ID 播放 */
  function playTrack(trackId: string) {
    const index = queue.value.findIndex((t) => t.id === trackId)
    if (index !== -1) {
      play(index)
    }
  }

  function togglePlay() {
    isPlaying.value = !isPlaying.value
  }

  function next() {
    if (queue.value.length === 0) return
    if (isLastTrack.value) {
      if (playMode.value === 'list-repeat') {
        currentIndex.value = 0
      }
      // sequential: 停在最后一首
    } else {
      currentIndex.value++
    }
  }

  function prev() {
    if (queue.value.length === 0) return
    if (isFirstTrack.value) {
      // 已经是第一首，重新播放
      currentTime.value = 0
    } else {
      currentIndex.value--
    }
  }

  function seek(time: number) {
    currentTime.value = time
    if (aplayerInstance.value) {
      aplayerInstance.value.seek(time)
    }
  }

  function setVolume(vol: number) {
    volume.value = vol
    if (aplayerInstance.value) {
      aplayerInstance.value.volume(vol)
    }
  }

  function toggleMute() {
    muted.value = !muted.value
    if (aplayerInstance.value) {
      aplayerInstance.value.volume(muted.value ? 0 : volume.value)
    }
  }

  function setPlayMode(mode: PlayMode) {
    playMode.value = mode
    if (aplayerInstance.value) {
      aplayerInstance.value.mode(mode === 'shuffle' ? 'random' : 'list')
    }
  }

  /** 追加到队列末尾 */
  function addToQueue(tracks: Track[]) {
    queue.value.push(...tracks)
  }

  /** 插入到当前之后播放 */
  function playNext(track: Track) {
    queue.value.splice(currentIndex.value + 1, 0, track)
  }

  function removeFromQueue(index: number) {
    if (index < 0 || index >= queue.value.length) return
    queue.value.splice(index, 1)
    // 移除的如果是当前或之前的曲目，调整 currentIndex
    if (index < currentIndex.value) {
      currentIndex.value--
    } else if (index === currentIndex.value && queue.value.length > 0) {
      // 移除的是当前曲目，跳到下一首（或上一首如果已经是最后一首）
      if (currentIndex.value >= queue.value.length) {
        currentIndex.value = queue.value.length - 1
      }
    }
  }

  function clearQueue() {
    queue.value = []
    currentIndex.value = 0
    isPlaying.value = false
    currentTime.value = 0
    duration.value = 0
  }

  function updateTime(t: number) {
    currentTime.value = t
  }

  function updateDuration(d: number) {
    duration.value = d
  }

  return {
    // State
    queue,
    currentIndex,
    isPlaying,
    currentTime,
    duration,
    volume,
    muted,
    playMode,
    aplayerInstance,
    // Getters
    currentTrack,
    queueLength,
    progress,
    isLastTrack,
    isFirstTrack,
    // Actions
    initPlayer,
    setQueue,
    play,
    playTrack,
    togglePlay,
    next,
    prev,
    seek,
    setVolume,
    toggleMute,
    setPlayMode,
    addToQueue,
    playNext,
    removeFromQueue,
    clearQueue,
    updateTime,
    updateDuration
  }
})
