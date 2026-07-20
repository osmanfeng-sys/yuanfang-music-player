import { usePlayerStore } from '@/stores/player'
import { usePlaylistStore } from '@/stores/playlist'
import type { Track, Playlist } from '@/types'

/**
 * 播放列表操作封装。
 */
export function usePlaylist() {
  const playerStore = usePlayerStore()
  const playlistStore = usePlaylistStore()

  /** 获取播放列表中所有曲目 */
  function getTracksFromPlaylist(playlist: Playlist): Track[] {
    return playlist.trackIds
      .map((id) => playlistStore.getTrackById(id))
      .filter((t): t is Track => t !== undefined)
  }

  /** 播放整个播放列表 */
  function playPlaylist(playlist: Playlist, startIndex = 0) {
    const tracks = getTracksFromPlaylist(playlist)
    if (tracks.length === 0) return
    playerStore.setQueue(tracks, startIndex)
    playerStore.isPlaying = true
  }

  /** 播放艺人全部歌曲 */
  function playArtist(artistId: string) {
    const tracks = playlistStore.getTracksByArtist(artistId)
    if (tracks.length === 0) return
    playerStore.setQueue(tracks, 0)
    playerStore.isPlaying = true
  }

  /** 添加曲目到当前队列末尾 */
  function addToQueue(track: Track) {
    playerStore.addToQueue([track])
  }

  /** 创建新播放列表并返回 */
  function createNewPlaylist(name: string, description?: string): Playlist {
    return playlistStore.createPlaylist(name, description)
  }

  return {
    getTracksFromPlaylist,
    playPlaylist,
    playArtist,
    addToQueue,
    createNewPlaylist
  }
}
