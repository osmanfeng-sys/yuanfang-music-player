import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { usePlaylistStore } from './playlist'

/**
 * Worker /list 的真实返回形状：只有 id / name / url / type / album，
 * **没有 title / artist / folder** —— 这些由前端 normalizeTrack 解析出来。
 *
 * 这里必须照着真实形状造数据。曾经 store 直接把这份原始对象当 Track 用，
 * 结果歌照放（播放只用 url），但歌名歌手是 undefined，
 * 列表、底部歌名全空白 —— 而且这种 bug 构建和类型检查都发现不了。
 */
const RAW_LIST = [
  {
    id: '031a434e721f314c',
    name: '郑源 - 一万个理由 [mqms2]',
    url: 'https://api.example.com/05_%E9%83%91%E6%BA%90/%E4%B8%80%E4%B8%AA%E7%90%86%E7%94%B1/playlist.m3u8',
    type: 'hls',
    album: '郑源'
  },
  {
    id: '0f0e5d9346d5ee2b',
    name: '伍佰 - 挪威的森林',
    url: 'https://api.example.com/10_%E4%BC%8D%E4%BD%B0/%E6%8C%AA%E5%A8%81%E7%9A%84%E6%A3%AE%E6%9E%97/playlist.m3u8',
    type: 'hls',
    album: '伍佰'
  }
]

function mockList(payload: unknown = RAW_LIST) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(payload), { status: 200 }))
  )
}

describe('playlist store / fetchPlaylists', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('把 /list 的原始对象解析成 Track：title / artist / folder / album 都不能缺', async () => {
    mockList()
    const store = usePlaylistStore()
    await store.fetchPlaylists()

    const t = store.allTracks.find((x) => x.title === '一万个理由')
    expect(t).toBeDefined()
    expect(t!.artist).toBe('郑源')
    expect(t!.folder).toBe('05_郑源')
    expect(t!.album).toBe('郑源')
  })

  it('folders / artists 据此正确分组，且每组曲目都有歌名', async () => {
    mockList()
    const store = usePlaylistStore()
    await store.fetchPlaylists()

    expect(store.folders.map((f) => f.name)).toEqual(['05_郑源', '10_伍佰'])
    expect(store.artists.map((a) => a.name).sort()).toEqual(['伍佰', '郑源'])
    expect(store.artists.flatMap((a) => a.tracks).every((t) => !!t.title && !!t.artist)).toBe(true)
  })

  it('网络失败写入 error，而不是静默变成空列表', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('boom')
      })
    )
    const store = usePlaylistStore()
    await store.fetchPlaylists()

    expect(store.error).toBeTruthy()
    expect(store.loading).toBe(false)
  })
})
