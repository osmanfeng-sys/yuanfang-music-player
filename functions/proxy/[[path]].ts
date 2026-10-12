import worker from '../../worker/src/index'
import type { Env } from '../../worker/src/utils/types'

/**
 * Pages Functions 入口：`/proxy/*`（音频流，支持 Range）
 *
 * ⚠️ 音频为什么必须挪到 `/proxy/` 前缀下：现在它在 Worker 的**根路径**上
 * （`https://api.yuanfangorganics.ccwu.cc/01_AQUA/xxx.mp3`）。搬到 Pages 之后
 * 根路径属于静态托管 —— `/01_AQUA/...` 会被当成"找不到的静态文件"直接 404，
 * 根本没机会进 Function。所以统一挂到 `/proxy/` 下。
 *
 * `worker/src/routes/proxy.ts` 已同时兼容「带 /proxy 前缀」和「不带」两种形态，
 * 迁移期间新旧两条路都能用，不用同时切。
 */
export const onRequest = (context: {
  request: Request
  env: Env
  waitUntil(promise: Promise<unknown>): void
}): Promise<Response> => worker.fetch(context.request, context.env, context)
