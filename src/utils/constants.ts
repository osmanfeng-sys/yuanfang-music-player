/** localStorage key 前缀 */
export const STORAGE_PREFIX = 'ym:'

/** 每页曲目数量 */
export const PAGE_SIZE = 50

/** 最大播放历史记录数 */
export const MAX_HISTORY = 100

/** 搜索防抖延迟（毫秒） */
export const SEARCH_DEBOUNCE_MS = 300

/** Worker API 基础 URL
 *  中国大陆用户需使用自定义域名（workers.dev 域名在大陆被屏蔽）
 *  生产: https://api.yuanfangorganics.ccwu.cc
 *  回退: https://music-proxy.osmanfeng.workers.dev
 */
export const WORKER_BASE_URL = 'https://api.yuanfangorganics.ccwu.cc'
