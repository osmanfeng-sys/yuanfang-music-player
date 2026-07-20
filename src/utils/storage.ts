import { STORAGE_PREFIX } from './constants'

/**
 * 从 localStorage 读取并解析 JSON 数据。
 * 解析失败时返回 fallback 值。
 */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

/**
 * 将值序列化为 JSON 写入 localStorage。
 * 存储空间满时静默失败。
 */
export function saveJSON(key: string, value: unknown): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    // localStorage 满时静默失败
  }
}

/**
 * 从 localStorage 删除指定键。
 */
export function removeKey(key: string): void {
  try {
    localStorage.removeItem(STORAGE_PREFIX + key)
  } catch {
    // 静默失败
  }
}

/**
 * 清除所有以 STORAGE_PREFIX 开头的 localStorage 项。
 */
export function clearAll(): void {
  try {
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(STORAGE_PREFIX)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key))
  } catch {
    // 静默失败
  }
}
