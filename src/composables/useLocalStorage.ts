import { ref, watch, type Ref } from 'vue'
import { STORAGE_PREFIX } from '@/utils/constants'

/**
 * 将 localStorage 封装为响应式 ref。
 * 值变化时自动持久化到 localStorage。
 *
 * @example
 * ```ts
 * const theme = useLocalStorage('theme', 'dark')
 * theme.value = 'light' // 自动写入 localStorage
 * ```
 */
export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T> {
  const storageKey = STORAGE_PREFIX + key

  // 尝试从 localStorage 读取
  let initial = defaultValue
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw !== null) {
      initial = JSON.parse(raw) as T
    }
  } catch {
    // 解析失败使用默认值
  }

  const data = ref<T>(initial) as Ref<T>

  // 自动持久化
  watch(
    data,
    (val) => {
      try {
        localStorage.setItem(storageKey, JSON.stringify(val))
      } catch {
        // 存储满时静默失败
      }
    },
    { deep: true }
  )

  return data
}
