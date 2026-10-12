import worker from '../worker/src/index'
import type { Env } from '../worker/src/utils/types'

/**
 * Pages Functions 入口：`/list`（曲库索引）
 *
 * 整个迁移的原则是**不改业务代码** —— 这里只做一层签名适配，把 Pages 的
 * `context` 拆成 Worker 的 `(request, env, ctx)` 交给现有路由表。
 *
 * ⚠️ 刻意【不用】`functions/[[path]].ts` 全捕获：那会把 `/assets/*`、`/PIC/*`、
 * `/bg/*` 这些静态资源也拦下来交给后端，整站直接废掉。
 * 按具体路径建文件，Pages 只为这几个前缀调用 Function，其余照常走静态托管，
 * 也就不需要手写 `_routes.json`（那个文件正是之前让 Pages 部署报
 * `Failed to publish your Function` 的元凶）。
 */
export const onRequest = (context: {
  request: Request
  env: Env
  waitUntil(promise: Promise<unknown>): void
}): Promise<Response> => worker.fetch(context.request, context.env, context)
