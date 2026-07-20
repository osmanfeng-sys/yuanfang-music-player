import { computed } from 'vue'
import { usePlayerStore } from '@/stores/player'
import type { Track } from '@/types'

/**
 * 音频播放逻辑封装。
 * 提供便利方法操作 playerStore 中的播放器。
 */
export function useAudioPlayer() {
  const playerStore = usePlayerStore()

  /** 将 Track 转换为 APlayer 可接受的 audio 对象格式 */
  function buildAudioList(tracks: Track[]) {
    return tracks.map((track) => ({
      name: track.title,
      artist: track.artist,
      url: track.url,
      cover: track.cover || '',
      lrc: track.lyricsUrl || ''
    }))
  }

  /** 切换到指定索引的曲目 */
  function switchTrack(index: number) {
    playerStore.play(index)
  }

  /** 播放/暂停切换 */
  function togglePlay() {
    playerStore.togglePlay()
  }

  /** 播放进度（0-100 百分比） */
  const progressPercent = computed(() => {
    return Math.round(playerStore.progress * 100)
  })

  /** 根据 trackId 播放 */
  function playTrackById(trackId: string) {
    playerStore.playTrack(trackId)
  }

  /** 播放一组曲目（替换队列） */
  function playTracks(tracks: Track[], startIndex = 0) {
    playerStore.setQueue(tracks, startIndex)
    playerStore.isPlaying = true
  }

  return {
    buildAudioList,
    switchTrack,
    togglePlay,
    progressPercent,
    playTrackById,
    playTracks
  }
}
