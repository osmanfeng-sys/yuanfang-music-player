import { error } from '../utils/response'
import { getContentType } from '../utils/r2'
import type { Env } from '../utils/types'

/**
 * GET /* — 代理 R2 文件。
 *
 * 支持 HTTP Range：mp3 直传后靠它做流式播放和拖进度条 ——
 * 没有 Range 的话浏览器要下完整个文件（一首 5~10 MB，国内链路几十 KB/s）才能出声。
 * 老的 HLS 分片同样受益（hls.js 也会按需拉取）。
 */
export async function handleProxy(request: Request, env: Env, url: URL): Promise<Response> {
  const decodedKey = decodeURIComponent(url.pathname.substring(1))

  if (!decodedKey) {
    return new Response('Music Server is Running.', { status: 200 })
  }

  // 只在请求真的带 Range 时才启用分段读取。
  // 无条件传 request.headers 会让 R2 把普通请求也当成分段请求，回一个 206（内容虽完整，
  // 但语义不对，也让上游缓存的判定变混乱）。
  const rangeHeader = request.headers.get('Range')

  try {
    const object = await env.MUSIC.get(
      decodedKey,
      rangeHeader ? { range: request.headers } : undefined
    )
    if (!object) {
      return error('File Not Found', 404)
    }

    const headers = new Headers({
      'Content-Type': getContentType(decodedKey),
      'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      // 用带引号的 httpEtag（object.etag 是未加引号的原始哈希，回给 R2 会被拒）
      ETag: object.httpEtag
    })
    // HEAD 不能带 body
    const body = request.method === 'HEAD' ? null : (object.body as ReadableStream)

    // 分段响应只认「请求带了 Range 头」，不只看 object.range：
    // 实测 R2 binding 在没要求分段时也可能带出一个覆盖完整对象的 range，
    // 那种情况回 206 虽然内容完整，但语义不对（无 Range 的请求应当 200）。
    // 有 Range 时 object.range 的 offset/length 已按对象大小 clamp 过。
    const range = rangeHeader
      ? (object.range as { offset?: number; length?: number } | undefined)
      : undefined
    if (range) {
      const offset = range.offset ?? 0
      const length = range.length ?? object.size - offset
      // Content-Range 用的是【完整】对象大小，不是片段大小
      headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`)
      headers.set('Content-Length', String(length))
      return new Response(body, { status: 206, headers })
    }

    headers.set('Content-Length', String(object.size))
    return new Response(body, { status: 200, headers })
  } catch (e) {
    // 越界的 Range（如 bytes=99999999-）会让 R2 抛错，按规范回 416 而不是 500。
    // 只在确实带 Range 时这么判，否则是真的服务端故障。
    if (rangeHeader) {
      let total = 0
      try {
        total = (await env.MUSIC.head(decodedKey))?.size ?? 0
      } catch {
        // 拿不到大小就不写完整长度，416 本身仍是对的
      }
      return new Response(null, {
        status: 416,
        headers: {
          'Content-Range': `bytes */${total}`,
          'Accept-Ranges': 'bytes',
          'Access-Control-Allow-Origin': '*'
        }
      })
    }
    const message = e instanceof Error ? e.message : 'Unknown error'
    return error(`Proxy error: ${message}`)
  }
}
