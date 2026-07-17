export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // 统一路径解码，确保包含中文或特殊字符的文件名能正确寻址
    const decodedKey = decodeURIComponent(url.pathname.substring(1));

    // 处理预检请求 (CORS)
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "*",
        }
      });
    }

    if (!decodedKey) {
      return new Response('Music Server is Running.', { status: 200 });
    }

    try {
      const object = await env.MUSIC.get(decodedKey);

      if (!object) {
        return new Response('File Not Found', { status: 404 });
      }

      // 根据扩展名设置正确的 MIME 类型
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
};