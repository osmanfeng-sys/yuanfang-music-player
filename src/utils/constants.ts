/** localStorage key 前缀 */
export const STORAGE_PREFIX = 'ym:'

/** 每页曲目数量 */
export const PAGE_SIZE = 50

/** 最大播放历史记录数 */
export const MAX_HISTORY = 100

/** 搜索防抖延迟（毫秒） */
export const SEARCH_DEBOUNCE_MS = 300

/**
 * API 基础 URL。
 *
 * 空串 = **同源**：API 已从独立 Worker 迁到 Pages Functions，和页面同域。
 *
 * 这不只是省一个常量。原来的 `api.yuanfangorganics.ccwu.cc` 所在的 `ccwu.cc`
 * 后缀被 GFW **概率性阻断**（实测两个子域通过率都只有 ~40%，偶尔漏过），
 * 云端歌单因此长期不可用、表现为"新建歌单保存不了"。而 `pages.dev` 实测
 * 国内直连 100% 可达。
 *
 * 独立 Worker 仍在部署（`api.yuanfangorganics.ccwu.cc`）作为回退通道；
 * 要切回去把这个常量改回那个绝对地址即可，其余代码不用动。
 */
export const WORKER_BASE_URL = ''
