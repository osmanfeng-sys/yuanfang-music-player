/**
 * HLS 分片预取。
 *
 * 背景：本机到 Cloudflare 的单连接吞吐只有 ~24 KB/s，而并行连接可到 ~72 KB/s
 * （实测），因此用有限并发把分片提前拉进浏览器缓存，能显著减少播放中的卡顿。
 * 预取会回填 Cloudflare 边缘缓存，对后续播放同样有效。
 */

/** 已预取的 m3u8，避免重复拉取 */
const prefetched = new Set<string>()

/** 并发数：太高会和正在播放的分片抢带宽 */
const CONCURRENCY = 3

/** 解析 m3u8 中的分片文件名 */
function parseSegments(m3u8: string): string[] {
  return [...m3u8.matchAll(/^([^\s#][^\s]*\.ts)\s*$/gm)].map((m) => m[1])
}

/**
 * 预取某个曲目的全部分片。
 * 不阻塞调用方，失败静默忽略（播放本身仍会按需加载）。
 */
export async function prefetchHlsSegments(m3u8Url: string): Promise<void> {
  if (!m3u8Url || prefetched.has(m3u8Url)) return
  prefetched.add(m3u8Url)

  try {
    const res = await fetch(m3u8Url)
    if (!res.ok) return
    const segments = parseSegments(await res.text())
    if (segments.length === 0) return

    const base = m3u8Url.slice(0, m3u8Url.lastIndexOf('/') + 1)

    // 顺序分批、批内并行：既提升吞吐，又不至于一次占满带宽
    for (let i = 0; i < segments.length; i += CONCURRENCY) {
      await Promise.allSettled(
        segments.slice(i, i + CONCURRENCY).map((s) => fetch(base + s))
      )
    }
  } catch {
    // 预取失败不影响播放
  }
}
