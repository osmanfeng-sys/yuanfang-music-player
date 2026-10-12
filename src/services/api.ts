import { WORKER_BASE_URL } from '@/utils/constants'
import { currentUserKey } from '@/utils/userKey'
import type { ApiResponse } from '@/types'

/**
 * 通用请求函数 — 封装 fetch + 错误处理 + 超时
 */
async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>> {
  const url = `${WORKER_BASE_URL}${endpoint}`

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 15000)

    // 用户 key 只在设置过「歌单同步」凭据后才有；没设置就不带这个头，
    // 服务端会回 401（歌单功能当前无入口，不影响其余接口）。
    // 在这里统一注入，省得每个调用点各自拼 header。
    const userKey = await currentUserKey()

    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(userKey ? { 'X-User-Key': userKey } : {}),
        ...options?.headers
      }
    })
    clearTimeout(timeoutId)

    if (!res.ok) {
      const text = await res.text().catch(() => '')
      return {
        success: false,
        error: `HTTP ${res.status}${text ? `: ${text}` : ''}`
      }
    }

    // 204 No Content
    if (res.status === 204) {
      return { success: true }
    }

    const data = (await res.json()) as T
    return { success: true, data }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      return { success: false, error: '请求超时' }
    }
    const message = e instanceof Error ? e.message : '未知网络错误'
    return { success: false, error: message }
  }
}

/** GET 请求 */
export function get<T>(endpoint: string): Promise<ApiResponse<T>> {
  return request<T>(endpoint, { method: 'GET' })
}

/** POST 请求 */
export function post<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(body)
  })
}

/** PUT 请求 */
export function put<T>(endpoint: string, body: unknown): Promise<ApiResponse<T>> {
  return request<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(body)
  })
}

/** DELETE 请求 */
export function del<T>(endpoint: string): Promise<ApiResponse<T>> {
  return request<T>(endpoint, { method: 'DELETE' })
}
