import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

/**
 * 用户歌单的云端分支测试。
 *
 * userKey 整个 mock 掉，让 store 认为「已配置云端凭据」从而走云端；
 * 顺带避开真实 crypto.subtle / localStorage 的环境依赖。
 * （本机模式的分支跑在 localStorage 上，靠手工验证覆盖，见 project-plan.md）
 */
vi.mock('@/utils/userKey', () => ({
  loadCredentials: () => ({ id: 'tester', pass: 'password123' }),
  currentUserKey: async () => 'AAAAAAAAAAAAAAAAAAAAAA'
}))

import { usePlaylistStore } from './playlist'
import type { Playlist } from '@/types'

function mockFetch(status: number, payload: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(payload), { status }))
  )
}

/** 直接往 state 里塞一条，模拟「上一次成功加载后界面上已有的歌单」 */
function seed(store: ReturnType<typeof usePlaylistStore>, id: string, name: string) {
  const p: Playlist = {
    id,
    name,
    trackIds: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    source: 'user'
  }
  store.playlists[id] = p
}

describe('playlist store / 用户歌单（云端模式）', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  /**
   * 这是本项目最容易造成真实数据丢失的一条路径：
   * 密码打错 → Worker 回 401 → fetchUserPlaylists 返回 null。
   * 如果调用方把 null 当成「没有歌单」，界面会被清空，
   * 用户会以为歌单被删了 —— 所以必须区分「失败」和「空」。
   */
  it('云端 401（密码打错）不能把界面上已有的歌单清空', async () => {
    mockFetch(401, { success: false, error: 'Unauthorized' })
    const store = usePlaylistStore()
    seed(store, 'p1', '别把我弄丢')

    await store.loadUserPlaylists()

    expect(store.userPlaylists.map((p) => p.name)).toEqual(['别把我弄丢'])
    expect(store.error).toBeTruthy()
  })

  /** 与上一条对照：空数组是「这个身份下确实没有歌单」，不该报错 */
  it('云端返回空数组是正常情况，不写 error', async () => {
    mockFetch(200, [])
    const store = usePlaylistStore()

    await store.loadUserPlaylists()

    expect(store.userPlaylists).toEqual([])
    expect(store.error).toBeFalsy()
  })

  /**
   * Worker 的创建接口不返回 source（老版本），而 userPlaylists 是
   * 按 source === 'user' 过滤的 —— 前端必须自己补上，
   * 否则新建的歌单立刻"消失"，且只有真机点一遍才会发现。
   */
  it('云端创建的歌单会自动补 source=user，从而出现在 userPlaylists 里', async () => {
    mockFetch(201, {
      id: 'uuid-1',
      name: '新歌单',
      trackIds: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z'
      // 故意不带 source
    })
    const store = usePlaylistStore()

    const created = await store.createPlaylist('新歌单')

    expect(created?.id).toBe('uuid-1')
    expect(store.userPlaylists.map((p) => p.name)).toEqual(['新歌单'])
  })

  it('创建歌单时把 trackIds 一起送出去（CreatePlaylistRequest 必填字段）', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({
          id: 'uuid-2',
          name: 'x',
          trackIds: [],
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z'
        }),
        { status: 201 }
      )
    )
    vi.stubGlobal('fetch', fetchMock)
    const store = usePlaylistStore()

    await store.createPlaylist('x')

    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string)
    expect(body.trackIds).toEqual([])
  })
})
