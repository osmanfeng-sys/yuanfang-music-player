import { STORAGE_PREFIX } from './constants'

/** localStorage 键名 */
const ID_KEY = `${STORAGE_PREFIX}userId`
const PASS_KEY = `${STORAGE_PREFIX}userPass`

export interface Credentials {
  id: string
  pass: string
}

/**
 * 由「用户 ID + 密码」派生 user key —— 它既是请求凭据，也是云端歌单的存储路径片段。
 *
 * 取 SHA-256 → base64url 的**前 22 位**（约 132 bit）：
 * ① 字符集只有 `A-Za-z0-9_-`，**天然路径安全** —— 服务端不必再做转义或 `../` 穿越校验；
 * ② 密码不到服务端：前端算完只发 key，Worker 侧零密码逻辑（无 salt、无 401 流程、不落库）。
 *
 * ⚠️ 这是「防误入 / 防随手翻」，**不是防定向攻击**：ID 已知 + 弱密码可以被在线爆破
 *    （带候选 key 请求 /api/playlists，返回空数组还是非空就是一个 oracle，且没有限流）。
 *    所以 UI 上强制密码至少 8 位。
 *
 * 需要**安全上下文**（HTTPS 或 localhost）：`crypto.subtle` 在 http://局域网IP 下不可用。
 */
export async function deriveUserKey(id: string, pass: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${id}:${pass}`))
  const b64 = btoa(String.fromCharCode(...new Uint8Array(digest)))
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '').slice(0, 22)
}

/** 读取本机保存的凭据；未设置返回 null */
export function loadCredentials(): Credentials | null {
  try {
    const id = localStorage.getItem(ID_KEY)
    const pass = localStorage.getItem(PASS_KEY)
    return id && pass ? { id, pass } : null
  } catch {
    return null
  }
}

/** 保存凭据（顺带作废派生缓存） */
export function saveCredentials(id: string, pass: string) {
  try {
    localStorage.setItem(ID_KEY, id)
    localStorage.setItem(PASS_KEY, pass)
  } catch {
    // 隐私模式下 localStorage 可能不可写，忽略
  }
  cacheRaw = ''
}

/** 清除凭据 —— 之后请求不再带 key，歌单退回「只存本机」 */
export function clearCredentials() {
  try {
    localStorage.removeItem(ID_KEY)
    localStorage.removeItem(PASS_KEY)
  } catch {
    // 同上
  }
  cacheRaw = ''
}

// 派生结果缓存：api.ts 每个请求都会问一次，SHA-256 虽快也没必要反复算。
// 用「原文」当缓存键，凭据一变自动失效，不用手工 invalidate。
let cacheRaw = ''
let cacheKey = ''

/** 当前生效的 user key；未设置凭据（或环境不支持加密）时返回 null */
export async function currentUserKey(): Promise<string | null> {
  const c = loadCredentials()
  if (!c) return null

  const raw = `${c.id}:${c.pass}`
  if (raw !== cacheRaw) {
    try {
      cacheKey = await deriveUserKey(c.id, c.pass)
      cacheRaw = raw
    } catch {
      return null // 非安全上下文下 crypto.subtle 不可用，退化为不带 key
    }
  }
  return cacheKey
}
