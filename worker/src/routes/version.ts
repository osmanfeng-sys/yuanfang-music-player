import { json, error } from '../utils/response'
import { getJSON } from '../utils/r2'
import type { Env } from '../utils/types'

/**
 * R2 里 `version.json` 的结构 —— **由 release-apk.mjs 生成，不手写**。
 *
 * 手写会和 android/app/build.gradle 的 versionCode 漂移，
 * 而漂移的后果是「永远提示更新」或「永远不提示」，两种都很难查。
 */
export interface VersionManifest {
  versionCode: number
  versionName: string
  /** APK 的下载地址（R2 里的 key，经 /proxy 出去） */
  url: string
  notes?: string
  publishedAt?: string
}

/**
 * GET /api/version — 客户端检查更新用（只读）。
 *
 * 只读 R2 的 version.json，不写任何东西、不加任何绑定。
 * 找不到就回 404 —— 前端把 404 当作"没有版本信息"，静默不提示，
 * 不要回一个假的默认版本号，否则会一直提示更新。
 */
export async function handleGetVersion(_request: Request, env: Env): Promise<Response> {
  const v = await getJSON<VersionManifest>(env, 'version.json')
  if (!v || typeof v.versionCode !== 'number') {
    return error('Version manifest not found', 404)
  }
  return json(v)
}
