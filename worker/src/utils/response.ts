import type { Track } from './types'

// ===== Response 构建器 =====

/** CORS 头（允许前端跨域请求） */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type'
}

/** JSON 成功响应 */
export function json<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  })
}

/** 错误响应 */
export function error(message: string, status = 500): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS
    }
  })
}

/** 204 无内容 */
export function noContent(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  })
}

/** OPTIONS 预检 */
export function corsPreflight(): Response {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  })
}

/** 文件流响应（用于 R2 代理） */
export function streamResponse(
  body: ReadableStream,
  contentType: string
): Response {
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=3600',
      ...CORS_HEADERS
    }
  })
}

/** 从 URL 路径中提取路由参数 */
export function extractParam(path: string, prefix: string): string | null {
  if (!path.startsWith(prefix)) return null
  const rest = path.slice(prefix.length)
  // 移除末尾斜杠
  return rest.replace(/\/$/, '') || null
}

/** 标准化 Track 对象（从原始 playlist.json 数据） */
export function normalizeTrack(raw: {
  name?: string
  url: string
  type?: string
}): Track | null {
  if (!raw.name) return null
  const name = raw.name
  const url = raw.url
  if (!url) return null

  return {
    id: generateTrackId(name),
    name,
    url,
    type: 'hls'
  }
}

/** 从 name 生成稳定的 ID */
function generateTrackId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9一-鿿]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 100)
}
