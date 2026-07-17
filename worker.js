export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // 1. 处理预检请求 (CORS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        }
      });
    }

    // 2. 路由：处理 /list 请求
    if (path === '/list') {
      try {
        const object = await env.MUSIC.get('playlist.json');
        if (!object) {
          return new Response('Playlist Not Found', { status: 404 });
        }
        return new Response(object.body, {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      } catch (e) {
        return new Response('Error: ' + e.message, { status: 500 });
      }
    }

    // 3. 路由：处理文件获取 (R2 代理)
    const decodedKey = decodeURIComponent(path.substring(1));
    if (decodedKey && decodedKey !== 'list') {
      try {
        const object = await env.MUSIC.get(decodedKey);
        if (!object) {
          return new Response('File Not Found', { status: 404 });
        }

        const contentType = decodedKey.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 
                            decodedKey.endsWith('.ts') ? 'video/MP2T' : 'application/octet-stream';

        return new Response(object.body, {
          headers: {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=3600'
          }
        });
      } catch (e) {
        return new Response('Error: ' + e.message, { status: 500 });
      }
    }

    // 4. 默认根路径响应
    return new Response('Music Server is Running.', { status: 200 });
  }
};