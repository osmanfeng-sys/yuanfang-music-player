import worker from '../../worker/src/index'
import type { Env } from '../../worker/src/utils/types'

/**
 * Pages Functions 入口：`/api/*`
 *
 * 艺人 / 搜索 / 歌词 / 歌单 CRUD 全部走这里。路由表仍在 `worker/src/index.ts`，
 * 那边按**完整 pathname** 匹配（`/api/playlists` 等），所以这里不用做任何路径改写。
 */
export const onRequest = (context: {
  request: Request
  env: Env
  waitUntil(promise: Promise<unknown>): void
}): Promise<Response> => worker.fetch(context.request, context.env, context)
