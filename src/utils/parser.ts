import type { ParsedTrackName } from '@/types'

/**
 * 解析 Track 原始 name 字段为 artist 和 title。
 *
 * 支持三种格式：
 *   1. "Artist - Title"（标准）
 *   2. "Artist- Title"（无前半空格）
 *   3. 纯文本（无分隔符）→ 整个当标题，artist 为 "Unknown"
 *
 * 同时清理 [mqms2] 等尾缀。
 */
export function parseTrackName(rawName: string): ParsedTrackName {
  const dashPattern = /^(.+?)\s*-\s+(.+)$/
  const match = rawName.match(dashPattern)

  if (match) {
    let artist = match[1].trim()
    let title = match[2].trim()
    // 清理 [mqms2] 等后缀
    title = title.replace(/\s*\[.*?\]\s*$/, '').trim()
    return { artist, title }
  }

  // Fallback: 没有分隔符 → 整段当标题
  return { artist: 'Unknown', title: rawName.trim() }
}

/**
 * 从 R2 路径提取人工可读的 Track 名称。
 * 路径格式通常为 "Artist Name/Track Name/playlist.m3u8"
 */
export function extractNameFromPath(path: string): string {
  // 取倒数第二段（曲目目录名）
  const parts = path.split('/').filter(Boolean)
  if (parts.length >= 2) {
    return parts[parts.length - 2]
  }
  return path
}

/**
 * 生成稳定的 Track ID。
 * 格式: encodeURIComponent("artist_title").toLowerCase() 的简化 slug
 */
export function generateTrackId(artist: string, title: string): string {
  const raw = `${artist}_${title}`
    .toLowerCase()
    .replace(/[^a-z0-9_一-鿿]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
  return raw.slice(0, 100)
}
