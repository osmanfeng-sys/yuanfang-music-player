import { STORAGE_PREFIX } from './constants'

/**
 * localStorage 的 JSON 读写，key 统一带 `ym:` 前缀。
 *
 * 这两个函数原本是 `stores/user.ts` 私有的。playlist store 要落盘时本来只能再抄一份，
 * 所以提到 utils —— user / playlist 两个 store 共用一份实现。
 */
export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function saveJSON(key: string, value: unknown) {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(value))
  } catch {
    // localStorage 满 / 隐私模式下不可写，静默失败
  }
}
