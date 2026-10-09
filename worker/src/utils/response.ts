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

/**
 * 从媒资 URL 取专辑名。
 *
 * R2 目录结构为 "<音乐夹>/<曲目名>/playlist.m3u8"，没有独立的专辑层级，
 * 因此把一级目录去掉 "01_" 这类序号前缀后当作专辑名。
 * 放在 Worker 侧派生，老 playlist.json 无需重扫即可生效。
 */
function albumFromUrl(url: string): string | undefined {
  try {
    const seg = decodeURIComponent(new URL(url).pathname).split('/').filter(Boolean)[0]
    return seg ? seg.replace(/^\d+[_-]/, '') : undefined
  } catch {
    return undefined
  }
}

/** 标准化 Track 对象（从原始 playlist.json 数据） */
export function normalizeTrack(raw: {
  name?: string
  url: string
  type?: string
  album?: string
}): Track | null {
  if (!raw.name) return null
  const name = raw.name
  const url = raw.url
  if (!url) return null

  return {
    id: generateTrackId(name),
    name,
    url,
    type: 'hls',
    // playlist.json 里显式带了 album 就用它，否则从路径派生
    album: raw.album || albumFromUrl(url)
  }
}

/**
 * 从原始曲目名生成稳定的 ID（FNV-1a 64 位哈希的 16 位十六进制）。
 *
 * 必须与前端 `src/utils/parser.ts` 的 generateTrackId 完全一致：
 * 前端拿这个 ID 拼歌词 key，对不上就读不到云端歌词。
 */
function generateTrackId(name: string): string {
  const PRIME = 0x100000001b3n
  const MASK = 0xffffffffffffffffn
  let h = 0xcbf29ce484222325n
  for (let i = 0; i < name.length; i++) {
    h = ((h ^ BigInt(name.charCodeAt(i))) * PRIME) & MASK
  }
  return h.toString(16).padStart(16, '0')
}
