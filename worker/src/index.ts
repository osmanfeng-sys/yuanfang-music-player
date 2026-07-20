import { handleCORS } from './routes/cors'
import { handleList } from './routes/list'
import { handleProxy } from './routes/proxy'
import {
  handleGetArtists,
  handleGetArtistDetail,
  handleSearch
} from './routes/artists'
import {
  handleGetPlaylists,
  handleGetPlaylist,
  handleCreatePlaylist,
  handleUpdatePlaylist,
  handleDeletePlaylist
} from './routes/playlists'
import type { Env, RouteHandler } from './utils/types'

/** 路由表：方法+路径模式 → 处理器 */
const routes: Array<{
  pattern: RegExp
  methods: string[]
  handler: RouteHandler | ((req: Request, env: Env, ...args: string[]) => Response | Promise<Response>)
  paramNames?: string[]
}> = [
  // CORS 预检
  { pattern: /^\/.*$/, methods: ['OPTIONS'], handler: handleCORS },

  // 播放列表
  { pattern: /^\/list$/, methods: ['GET'], handler: handleList },
  { pattern: /^\/api\/playlists$/, methods: ['GET'], handler: handleGetPlaylists },
  { pattern: /^\/api\/playlists$/, methods: ['POST'], handler: handleCreatePlaylist },
  { pattern: /^\/api\/playlists\/(.+)$/, methods: ['GET'], handler: (req, env, id) => handleGetPlaylist(req, env, id) },
  { pattern: /^\/api\/playlists\/(.+)$/, methods: ['PUT'], handler: (req, env, id) => handleUpdatePlaylist(req, env, id) },
  { pattern: /^\/api\/playlists\/(.+)$/, methods: ['DELETE'], handler: (req, env, id) => handleDeletePlaylist(req, env, id) },

  // 艺人
  { pattern: /^\/api\/artists$/, methods: ['GET'], handler: handleGetArtists },
  { pattern: /^\/api\/artists\/(.+)$/, methods: ['GET'], handler: (req, env, id) => handleGetArtistDetail(req, env, id) },

  // 搜索
  { pattern: /^\/api\/search$/, methods: ['GET'], handler: handleSearch as RouteHandler },

  // R2 文件代理（兜底路由，放在最后）
  { pattern: /^\/.+$/, methods: ['GET', 'HEAD'], handler: handleProxy as RouteHandler },
]

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    // 遍历路由表匹配
    for (const route of routes) {
      if (!route.methods.includes(method)) continue

      const match = path.match(route.pattern)
      if (!match) continue

      // 如果有捕获组，作为额外参数传入
      if (match.length > 1) {
        return (route.handler as any)(request, env, match[1])
      }

      // 将完整 URL 传给需要读取 query/searchParams 的处理器
      return (route.handler as RouteHandler)(request, env, url)
    }

    // 无匹配 → 404
    return new Response('Not Found', { status: 404 })
  }
}
