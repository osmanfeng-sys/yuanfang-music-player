import { error, streamResponse } from '../utils/response'
import { getContentType } from '../utils/r2'
import type { Env } from '../utils/types'

/** GET /* — 代理 R2 文件 */
export async function handleProxy(request: Request, env: Env, url: URL): Promise<Response> {
  const decodedKey = decodeURIComponent(url.pathname.substring(1))

  if (!decodedKey) {
    return new Response('Music Server is Running.', { status: 200 })
  }

  try {
    const object = await env.MUSIC.get(decodedKey)
    if (!object) {
      return error('File Not Found', 404)
    }

    const contentType = getContentType(decodedKey)
    const body = object.body as ReadableStream

    return streamResponse(body, contentType)
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error'
    return error(`Proxy error: ${message}`)
  }
}
