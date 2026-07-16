export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const key = url.pathname.substring(1);

    // 处理预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        }
      });
    }

    if (!key) {
      return new Response('Music Server is Running.', { status: 200 });
    }

    try {
      const object = await env.MUSIC.get(key);

      if (!object) {
        return new Response('File Not Found', { status: 404 });
      }

      const contentType = key.endsWith('.m3u8') ? 'application/vnd.apple.mpegurl' : 
                          key.endsWith('.ts') ? 'video/MP2T' : 'application/octet-stream';

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
};