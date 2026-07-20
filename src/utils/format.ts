/**
 * 格式化时长（秒 → mm:ss 或 h:mm:ss）
 */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'

  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)

  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/**
 * 格式化文件大小（bytes → 可读字符串）
 */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let index = 0
  let size = bytes

  while (size >= 1024 && index < units.length - 1) {
    size /= 1024
    index++
  }

  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

/**
 * 格式化数字（1000 → "1,000"）
 */
export function formatNumber(n: number): string {
  return n.toLocaleString('zh-CN')
}

/**
 * 相对时间（ISO string → "3 分钟前"）
 */
export function formatRelativeTime(isoString: string): string {
  const now = Date.now()
  const then = new Date(isoString).getTime()
  const diffMs = now - then

  if (diffMs < 0) return '刚刚'

  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 60) return '刚刚'

  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`

  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`

  const months = Math.floor(days / 30)
  if (months < 12) return `${months} 个月前`

  const years = Math.floor(months / 12)
  return `${years} 年前`
}

/**
 * 截断字符串，超出加省略号
 */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str
  return str.slice(0, maxLen - 1) + '…'
}
