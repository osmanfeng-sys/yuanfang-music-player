# yuanfang-music-player 全面重构实施计划

## Context

将当前 **单文件 Vanilla JS** 的在线音乐播放器完全重构为 **Vue 3 + TypeScript + Vite** 架构的现代化音乐平台。保持 Cloudflare Pages + Worker + R2 的部署架构，保留 APlayer 播放器。

**当前问题：** 所有前端代码在一个 `index.html` 中（400+ 行混合 HTML/CSS/JS），无组件化、无类型检查、无状态管理、无模块化、无测试、硬编码密钥、CI/CD 不一致。

**目标结果：** 一个可扩展、可维护、支持多艺人浏览、用户自定义播放列表、搜索、歌词显示的现代化音乐平台。

---

## Phase 1: 项目脚手架搭建

### 1.1 初始化 Vite + Vue 3 + TypeScript 项目

在 `yuanfang-music-player/` 目录下创建 Vue 3 项目结构（保留现有文件不动，新代码放在 `src/` 子目录）。

**执行命令：**
```bash
cd yuanfang-music-player
npm create vite@latest . -- --template vue-ts
# 选择覆盖时，手动保留现有 index.html, worker.js, wrangler.toml 等
```

### 1.2 安装依赖

```bash
# 核心
npm install vue-router@4 pinia

# APlayer (npm 包而非 CDN)
npm install aplayer

# hls.js
npm install hls.js

# 工具库
npm install @vueuse/core   # 常用 composition utilities

# 开发依赖
npm install -D @types/aplayer
npm install -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
npm install -D prettier eslint-plugin-vue
npm install -D vitest @vue/test-utils happy-dom
npm install -D sass  # 如需 SCSS
```

### 1.3 目录结构规划

```
yuanfang-music-player/
├── index.html                    # Vite 入口 HTML（替换现在的）
├── src/
│   ├── main.ts                   # 应用入口
│   ├── App.vue                   # 根组件
│   ├── router/
│   │   └── index.ts              # Vue Router 路由配置
│   ├── stores/
│   │   ├── player.ts             # 播放器状态 (Pinia)
│   │   ├── playlist.ts           # 播放列表状态
│   │   ├── user.ts               # 用户偏好 & 自定义列表
│   │   └── search.ts             # 搜索状态
│   ├── components/
│   │   ├── player/
│   │   │   ├── MusicPlayer.vue       # APlayer 封装组件
│   │   │   ├── PlayerControls.vue    # 播放控制条（自定义 UI 层）
│   │   │   └── LyricsPanel.vue       # 歌词面板
│   │   ├── playlist/
│   │   │   ├── PlaylistPanel.vue     # 播放列表面板
│   │   │   ├── PlaylistItem.vue      # 列表项
│   │   │   └── MyPlaylists.vue       # 用户自定义播放列表
│   │   ├── search/
│   │   │   ├── SearchBar.vue         # 搜索栏
│   │   │   └── SearchResults.vue     # 搜索结果
│   │   ├── artist/
│   │   │   ├── ArtistList.vue        # 艺人列表
│   │   │   └── ArtistCard.vue        # 艺人卡片
│   │   ├── layout/
│   │   │   ├── AppHeader.vue         # 顶部导航
│   │   │   ├── AppSidebar.vue        # 侧边栏（桌面端）
│   │   │   ├── AppFooter.vue         # 底部播放条
│   │   │   └── AppLayout.vue         # 整体布局容器
│   │   └── common/
│   │       ├── LoadingSpinner.vue    # 加载动画
│   │       ├── ErrorMessage.vue      # 错误提示
│   │       └── EmptyState.vue        # 空状态
│   ├── views/
│   │   ├── HomeView.vue          # 首页：推荐/最近播放
│   │   ├── BrowseView.vue        # 浏览：按艺人/专辑
│   │   ├── ArtistView.vue        # 艺人详情页
│   │   ├── PlaylistView.vue      # 播放列表详情页
│   │   ├── SearchView.vue        # 搜索结果页
│   │   └── SettingsView.vue      # 设置页
│   ├── services/
│   │   ├── api.ts                # API 基础封装 (fetch + 错误处理)
│   │   ├── music.ts              # 音乐相关 API
│   │   └── playlist.ts           # 播放列表 API
│   ├── types/
│   │   ├── music.ts              # 音乐相关类型定义
│   │   ├── playlist.ts           # 播放列表类型
│   │   └── api.ts                # API 响应类型
│   ├── utils/
│   │   ├── storage.ts            # localStorage 封装
│   │   ├── format.ts             # 格式化工具（时间、文件大小等）
│   │   └── constants.ts          # 常量定义
│   ├── assets/
│   │   ├── styles/
│   │   │   ├── variables.css     # CSS 变量（主题色、间距等）
│   │   │   ├── global.css        # 全局样式
│   │   │   └── aplayer-theme.css # APlayer 主题覆盖
│   │   └── images/               # 静态图片
│   └── composables/
│       ├── useAudioPlayer.ts     # 音频播放逻辑封装
│       ├── usePlaylist.ts        # 播放列表操作
│       └── useLocalStorage.ts    # localStorage 响应式封装
├── public/
│   └── favicon.svg
├── worker/
│   ├── index.ts                  # Worker 入口（TS 重构版）
│   └── routes.ts                 # 路由处理函数
├── scripts/
│   └── list-r2.ts                # R2 扫描脚本（TS 重写，从环境变量读凭证）
├── vite.config.ts                # Vite 配置
├── tsconfig.json                 # TypeScript 配置
├── tsconfig.node.json            # Node 端 TS 配置
├── wrangler.toml                 # 保留现有，微调
├── package.json                  # 更新
├── .env.example                  # 环境变量模板
├── .eslintrc.cjs                 # ESLint 配置
├── .prettierrc                   # Prettier 配置
└── README.md                     # 更新文档
```

---

## Phase 2: 类型系统 & 数据模型

### 2.1 `src/types/music.ts`

```typescript
// ========== 音乐文件相关 ==========

/** HLS 音轨 */
export interface Track {
  /** 唯一标识，格式: "artist_album_trackname" 的 hash 或 slug */
  id: string
  /** 歌曲名，如 "Barbie Girl" */
  title: string
  /** 艺人名，如 "Aqua" */
  artist: string
  /** 专辑名（可选，从路径推断） */
  album?: string
  /** R2 中 playlist.m3u8 的完整 Worker URL */
  url: string
  /** 封面图 URL（可选） */
  cover?: string
  /** 歌词文件 URL（可选） */
  lyricsUrl?: string
  /** 时长（秒），初始未知，播放后获取 */
  duration?: number
  /** 媒体类型 */
  type: 'hls'
}

/** 艺人 */
export interface Artist {
  /** 唯一标识 */
  id: string
  /** 艺人名 */
  name: string
  /** 艺人名（中文/日文/其他语言） */
  nameLocalized?: string
  /** 封面图 */
  cover?: string
  /** 该艺人的歌曲数量 */
  trackCount: number
  /** 该艺人的专辑列表 */
  albums: Album[]
}

/** 专辑 */
export interface Album {
  /** 唯一标识 */
  id: string
  /** 专辑名 */
  name: string
  /** 所属艺人 ID */
  artistId: string
  /** 封面图 */
  cover?: string
  /** 发行年份 */
  year?: number
  /** 曲目列表 */
  tracks: Track[]
}
```

### 2.2 `src/types/playlist.ts`

```typescript
/** 播放列表 */
export interface Playlist {
  /** UUID */
  id: string
  /** 播放列表名称 */
  name: string
  /** 描述 */
  description?: string
  /** 封面（第一首歌的封面或自定义） */
  cover?: string
  /** 曲目 ID 列表（有序） */
  trackIds: string[]
  /** 创建时间 (ISO 8601) */
  createdAt: string
  /** 更新时间 (ISO 8601) */
  updatedAt: string
  /** 来源: 系统内置 / 用户创建 / 收藏 */
  source: 'system' | 'user' | 'favorite'
}

/** 播放模式 */
export type PlayMode = 'sequential' | 'shuffle' | 'single-repeat' | 'list-repeat'
```

### 2.3 `src/types/api.ts`

```typescript
/** Worker API 通用响应 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
}

/** GET /list 响应 */
export type PlaylistResponse = Track[]

/** GET /api/artists 响应 */
export interface ArtistsResponse {
  artists: Artist[]
}

/** GET /api/artist/:id 响应 */
export interface ArtistDetailResponse {
  artist: Artist
  tracks: Track[]
}

/** POST /api/playlists 请求体 */
export interface CreatePlaylistRequest {
  name: string
  description?: string
  trackIds: string[]
}

/** PUT /api/playlists/:id 请求体 */
export interface UpdatePlaylistRequest {
  name?: string
  description?: string
  trackIds?: string[]
}
```

---

## Phase 3: 路由设计

### 3.1 `src/router/index.ts`

```typescript
import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('@/views/HomeView.vue'),
    meta: { title: '远方音乐 - 首页' }
  },
  {
    path: '/browse',
    name: 'browse',
    component: () => import('@/views/BrowseView.vue'),
    meta: { title: '浏览音乐' }
  },
  {
    path: '/artist/:id',
    name: 'artist',
    component: () => import('@/views/ArtistView.vue'),
    meta: { title: '艺人详情' },
    props: true
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('@/views/SearchView.vue'),
    meta: { title: '搜索' },
    props: (route) => ({ query: route.query.q || '' })
  },
  {
    path: '/playlist/:id',
    name: 'playlist',
    component: () => import('@/views/PlaylistView.vue'),
    meta: { title: '播放列表' },
    props: true
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('@/views/SettingsView.vue'),
    meta: { title: '设置' }
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('@/views/NotFoundView.vue'),
    meta: { title: '404' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 }
  }
})

// 动态 title
router.afterEach((to) => {
  document.title = (to.meta.title as string) || '远方音乐'
})

export default router
```

| 路由 | 组件 | 说明 |
|------|------|------|
| `/` | HomeView | 首页：最近播放 + 推荐 + 快速入口 |
| `/browse` | BrowseView | 艺人列表 + 专辑浏览 |
| `/artist/:id` | ArtistView | 艺人详情，显示专辑和全部歌曲 |
| `/search?q=xxx` | SearchView | 搜索结果 |
| `/playlist/:id` | PlaylistView | 播放列表详情（含用户自定义） |
| `/settings` | SettingsView | 用户设置（主题、播放偏好） |
| `/*` | NotFoundView | 404 页面 |

---

## Phase 4: 状态管理 (Pinia Stores)

### 4.1 `src/stores/player.ts` — 播放器核心状态

```typescript
interface PlayerState {
  // ===== 当前播放队列 =====
  /** 当前播放队列（有序） */
  queue: Track[]
  /** 当前播放索引（指向 queue） */
  currentIndex: number
  
  // ===== 播放状态 =====
  /** 播放状态 */
  isPlaying: boolean
  /** 当前播放时间（秒） */
  currentTime: number
  /** 总时长（秒） */
  duration: number
  /** 音量 0-1 */
  volume: number
  /** 是否静音 */
  muted: boolean
  
  // ===== 播放模式 =====
  playMode: PlayMode
  
  // ===== APlayer 实例引用 =====
  /** APlayer 实例（由 MusicPlayer 组件挂载后设置） */
  aplayerInstance: APlayer | null
}

// Getters:
// - currentTrack: Track | null           // queue[currentIndex]
// - queueLength: number
// - progress: number                      // currentTime / duration (0-1)
// - isLastTrack: boolean
// - isFirstTrack: boolean

// Actions:
// - initPlayer(aplayer: APlayer): void           // 挂载 APlayer 实例
// - setQueue(tracks: Track[], startIndex?: number): void
// - play(index: number): void                    // 播放指定索引
// - playTrack(trackId: string): void             // 按 ID 播放
// - togglePlay(): void
// - next(): void
// - prev(): void
// - seek(time: number): void
// - setVolume(vol: number): void
// - toggleMute(): void
// - setPlayMode(mode: PlayMode): void
// - addToQueue(tracks: Track[]): void            // 追加到队列末尾
// - playNext(track: Track): void                 // 插入到当前之后播放
// - removeFromQueue(index: number): void
// - clearQueue(): void
// - updateTime(t: number): void                  // APlayer timeupdate 回调
// - updateDuration(d: number): void              // APlayer durationchange 回调
```

### 4.2 `src/stores/playlist.ts` — 播放列表管理

```typescript
interface PlaylistState {
  /** 所有播放列表（系统 + 用户） */
  playlists: Map<string, Playlist>
  /** 所有音轨缓存（避免重复请求） */
  trackCache: Map<string, Track>
  /** 艺人列表缓存 */
  artistCache: Artist[]
  /** 加载状态 */
  loading: boolean
  /** 错误信息 */
  error: string | null
}

// Getters:
// - systemPlaylists: Playlist[]         // source === 'system'
// - userPlaylists: Playlist[]           // source === 'user'
// - allTracks: Track[]                  // 从 trackCache 展开
// - getPlaylistById(id): Playlist
// - getTrackById(id): Track | undefined
// - getTracksByArtist(artistId): Track[]
// - searchTracks(query): Track[]        // 本地搜索

// Actions:
// - fetchPlaylists(): Promise<void>     // 从 Worker /list 加载
// - fetchTrack(trackId): Promise<Track>
// - createPlaylist(name, desc, trackIds): Promise<Playlist>
// - updatePlaylist(id, data): Promise<void>
// - deletePlaylist(id): Promise<void>
// - addToPlaylist(playlistId, trackId): Promise<void>
// - removeFromPlaylist(playlistId, trackId): Promise<void>
```

### 4.3 `src/stores/user.ts` — 用户偏好

```typescript
interface UserState {
  /** 主题：亮色/暗色/跟随系统 */
  theme: 'light' | 'dark' | 'system'
  /** 播放历史（最近 N 首） */
  playHistory: string[]      // trackId[]
  /** 收藏的歌曲 */
  favorites: string[]        // trackId[]
  /** 收藏的播放列表 */
  favoritePlaylists: string[] // playlistId[]
  /** 上次播放位置 */
  lastSession: {
    queue: string[]           // trackId[]
    currentIndex: number
    currentTime: number
  } | null
  /** 是否已初始化（从 localStorage 加载完成） */
  initialized: boolean
}

// Getters:
// - isDark: boolean (考虑 system 模式)
// - recentTracks: Track[]
// - isFavorite(trackId): boolean

// Actions:
// - init(): void             // 从 localStorage 加载
// - setTheme(theme): void    // 持久化 + 应用
// - addToHistory(trackId): void
// - toggleFavorite(trackId): void
// - saveSession(): void      // 保存当前播放状态
// - restoreSession(): {queue, index, time} | null
// - clearHistory(): void
```

### 4.4 `src/stores/search.ts` — 搜索

```typescript
interface SearchState {
  query: string
  results: Track[]
  isSearching: boolean
  searchHistory: string[]     // 最近搜索词
}

// Actions:
// - search(q: string): Promise<void>
// - clearResults(): void
```

---

## Phase 5: Track 名称解析器（关键！）

当前 `playlist.json` 中的 `name` 字段存在 **3 种不一致格式**：

| 格式 | 示例 | 数量 |
|------|------|------|
| `Artist - Title` | `Aqua - Barbie Girl` | ~254 首 |
| `Artist- Title`（无空格） | `指南针(罗琦)- 不想再是小孩` | 若干 |
| 纯文本（无分隔符） | `2007062760693141`, `与你到永久` | 若干 |

**File: `src/utils/parser.ts`**

```typescript
export interface ParsedTrackName {
  artist: string
  title: string
}

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
```

---

## Phase 6: APlayer + hls.js 集成详解（最关键组件）

### 技术难点

APlayer v1 内部使用 `<audio>` 元素，不原生支持 HLS。当歌曲 `type: 'hls'` 时，URL 指向 `.m3u8` manifest 文件，需要 hls.js 接管。

### 解决方案

```
APlayer 实例创建
  ↓
监听 ap.on('listswitch') 事件
  ↓ (延迟 100ms 确保 DOM 就绪)
获取 ap.audio (当前 HTMLAudioElement)
  ↓
判断 src 是否以 .m3u8 结尾
  ↓ 是
1. 销毁旧 Hls 实例
2. 创建 new Hls() → hls.loadSource(url)
3. hls.attachMedia(audio)
  ↓ 否 (Safari 原生 HLS)
直接设置 audio.src = url
```

### MusicPlayer.vue 生命周期

```typescript
// onMounted:
//   1. new APlayer({ container, audio: [], ...config })
//   2. 注册事件监听 → 同步到 playerStore
//
// watch(tracks + currentIndex):
//   重建 APlayer 列表 → ap.list.clear() → ap.list.add([...]) → ap.list.switch(index)
//
// watch(isPlaying):  ap.play() / ap.pause()
// watch(volume):     ap.volume(vol)
// watch(playMode):   ap.mode(mode)
//
// onUnmounted:
//   销毁 Hls 实例 + APlayer 实例
```

---

## Phase 7: 组件树 & Props/Emits 详解

### 5.1 布局组件

#### `AppLayout.vue`
```
结构:
┌─────────────────────────────────────┐
│  AppHeader (固定顶部)               │
├──────────┬──────────────────────────┤
│          │                          │
│ AppSidebar  │  <router-view />     │
│ (桌面端)  │  (主内容区)            │
│          │                          │
├──────────┴──────────────────────────┤
│  AppFooter / MusicPlayer (固定底部) │
└─────────────────────────────────────┘
```
- **Props:** 无
- **State:** `isSidebarOpen: boolean`（移动端抽屉控制）

#### `AppHeader.vue`
- **Props:** 无
- **State:** 读取 `userStore.theme`
- **包含:** Logo、导航链接（首页/浏览）、SearchBar、设置入口

#### `AppSidebar.vue`
- **Props:** `isOpen: boolean`
- **Emits:** `close`, `navigate(path: string)`
- **内容:** 当前播放队列、系统播放列表快捷入口、用户播放列表

#### `AppFooter.vue`
- **Props:** 无
- **Slot:** `default`（嵌入 MusicPlayer）

### 5.2 播放器组件

#### `MusicPlayer.vue` — APlayer 封装
```
Props:
  - 无（通过 playerStore 通信）

职责:
  1. onMounted: 创建 new APlayer({ container, ...config })
  2. 将 aplayerInstance 注册到 playerStore.initPlayer()
  3. 监听 APlayer 事件 → 同步到 playerStore
  4. 监听 playerStore 变化 → 控制 APlayer

APlayer 配置:
  {
    container: this.$refs.playerContainer,
    autoplay: false,
    theme: '#1DB954',
    loop: 'all',
    order: 'list',
    preload: 'auto',
    volume: 0.7,
    mutex: true,          // 互斥：同时只有一个播放
    lrcType: 3,           // 歌词显示模式
    listFolded: true,     // 默认折叠播放列表
    listMaxHeight: '250px',
    audio: []             // 初始为空，动态设置
  }
```

#### `PlayerControls.vue` — 自定义播放控制条（可选，增强 APlayer 默认 UI）
```
Props:
  - track: Track | null
  - isPlaying: boolean
  - currentTime: number
  - duration: number
  - volume: number
  - playMode: PlayMode

Emits:
  - toggle-play
  - next
  - prev
  - seek(time: number)
  - volume-change(vol: number)
  - mode-change(mode: PlayMode)
  - toggle-playlist-panel
```

#### `LyricsPanel.vue` — 歌词面板
```
Props:
  - lyrics: string | null      // LRC 格式歌词文本
  - currentTime: number        // 当前播放时间，用于高亮当前行

State:
  - parsedLines: { time: number, text: string }[]  // 解析后的 LRC
  - activeIndex: number

职责:
  1. 解析 LRC 文本 → parsedLines
  2. 根据 currentTime 计算 activeIndex
  3. 自动滚动到当前歌词行
```

### 5.3 播放列表组件

#### `PlaylistPanel.vue`
```
Props:
  - tracks: Track[]
  - currentIndex: number
  - visible: boolean

Emits:
  - select(index: number)
  - remove(index: number)
  - close
```

#### `PlaylistItem.vue`
```
Props:
  - track: Track
  - index: number
  - isActive: boolean          // 是否当前播放
  - showRemove: boolean

Emits:
  - click(trackId: string)
  - remove(trackId: string)
  - add-to-playlist(trackId: string)
```

#### `MyPlaylists.vue`
```
Props:
  - playlists: Playlist[]

Emits:
  - select(playlistId: string)
  - create
  - delete(playlistId: string)
  - rename(playlistId: string, name: string)
```

### 5.4 搜索组件

#### `SearchBar.vue`
```
Props:
  - modelValue: string         // v-model
  - placeholder: string
  - autofocus: boolean

Emits:
  - update:modelValue(value: string)
  - search(query: string)
  - clear
```

#### `SearchResults.vue`
```
Props:
  - results: Track[]
  - loading: boolean
  - query: string

Emits:
  - play(trackId: string)
  - add-to-queue(trackId: string)
  - add-to-playlist(trackId: string)
```

### 5.5 艺人组件

#### `ArtistList.vue`
```
Props:
  - artists: Artist[]
  - loading: boolean

Emits:
  - select(artistId: string)
```

#### `ArtistCard.vue`
```
Props:
  - artist: Artist

Emits:
  - click(artistId: string)
  - play-all(artistId: string)
```

### 5.6 通用组件

#### `LoadingSpinner.vue`
```
Props:
  - size: 'sm' | 'md' | 'lg'   // 默认 'md'
  - text: string                // 加载文字
```

#### `ErrorMessage.vue`
```
Props:
  - message: string
  - retryable: boolean          // 是否显示重试按钮

Emits:
  - retry
```

#### `EmptyState.vue`
```
Props:
  - icon: string                // 图标名
  - title: string
  - description: string
  - actionText: string          // 操作按钮文字

Emits:
  - action
```

---

## Phase 8: API 服务层

> ✅ 已完整实现。参见 `src/services/api.ts`, `src/services/music.ts`, `src/services/playlist.ts`

### 8.1 `src/services/api.ts` — 基础封装

```typescript
const WORKER_BASE_URL = 'https://music-proxy.osmanfeng.workers.dev'

// 通用请求函数
async function request<T>(
  endpoint: string,
  options?: RequestInit
): Promise<ApiResponse<T>>

// 错误处理 + 重试逻辑
```

### 8.2 `src/services/music.ts` — 音乐 API

```typescript
// GET /list → Track[]
export async function fetchAllTracks(): Promise<Track[]>

// GET /*?key=xxx/playlist.m3u8 → (由 hls.js 直接调用，无需封装)
// 获取媒资 URL
export function getMediaUrl(path: string): string
// → `${WORKER_BASE_URL}/${encodeURIComponent(path)}`

// GET /api/artists → Artist[]
export async function fetchArtists(): Promise<Artist[]>

// GET /api/artist/:id → ArtistDetail
export async function fetchArtistDetail(id: string): Promise<ArtistDetailResponse>

// 搜索（前端本地搜索 + 未来后端搜索）
export async function searchTracks(query: string): Promise<Track[]>
```

### 8.3 `src/services/playlist.ts` — 播放列表 API

```typescript
// POST /api/playlists
export async function createPlaylist(data: CreatePlaylistRequest): Promise<Playlist>

// GET /api/playlists
export async function fetchUserPlaylists(): Promise<Playlist[]>

// PUT /api/playlists/:id
export async function updatePlaylist(id: string, data: UpdatePlaylistRequest): Promise<void>

// DELETE /api/playlists/:id
export async function deletePlaylist(id: string): Promise<void>
```

---

## Phase 9: Cloudflare Worker 重构（TypeScript）

> ✅ 已完整实现。参见 `worker/src/index.ts` + `worker/src/routes/*.ts` + `worker/src/utils/*.ts`

### 9.0 Worker 独立目录结构

Worker 有独立的依赖（`@cloudflare/workers-types`, `esbuild` vs `vite`）和构建流程，放在 `worker/` 子目录，有独立的 `package.json` 避免依赖冲突。

```
worker/
├── src/
│   ├── index.ts              # Worker 入口，路由分发
│   ├── routes/
│   │   ├── list.ts           # GET /list
│   │   ├── proxy.ts          # GET /* (R2 代理)
│   │   ├── playlists.ts      # CRUD /user-playlists/*
│   │   └── cors.ts           # OPTIONS 预检
│   └── utils/
│       ├── response.ts       # JSON/错误响应构建器
│       └── r2.ts             # R2 交互辅助
├── dist/                     # esbuild 输出 (gitignored)
├── tsconfig.json             # Worker 专用 TS 配置
└── package.json              # Worker 专用依赖
```

**`worker/package.json`:**
```json
{
  "name": "yuanfang-music-worker",
  "private": true,
  "scripts": {
    "build": "esbuild src/index.ts --bundle --outfile=dist/worker.js --format=esm --platform=neutral",
    "deploy": "npm run build && wrangler deploy dist/worker.js --name music-proxy"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.0.0",
    "esbuild": "^0.20.0"
  }
}
```

**`wrangler.toml` 更新 main 路径:**
```toml
name = "music-proxy"
main = "worker/dist/worker.js"
compatibility_date = "2026-07-16"

[[r2_buckets]]
binding = "MUSIC"
bucket_name = "music-bucket"
```

### 9.1 重构为 TypeScript

保持现有路由逻辑，新增以下端点：

| 方法 | 路径 | 说明 | 请求参数 | 响应 |
|------|------|------|----------|------|
| GET | `/list` | **保留** 获取全部播放列表 | — | `Track[]` |
| GET | `/*` | **保留** 代理 R2 文件 | 路径即 R2 key | 文件流 |
| OPTIONS | `*` | **保留** CORS 预检 | — | 204 + CORS headers |
| GET | `/api/artists` | **新增** 获取艺人列表 | — | `{ artists: Artist[] }` |
| GET | `/api/artists/:id` | **新增** 艺人详情 | — | `ArtistDetailResponse` |
| GET | `/api/search?q=xxx` | **新增** 搜索 | `q: string` | `{ results: Track[] }` |
| POST | `/api/playlists` | **新增** 创建播放列表 | `CreatePlaylistRequest` | `Playlist` |
| GET | `/api/playlists/:id` | **新增** 获取播放列表 | — | `Playlist` |
| PUT | `/api/playlists/:id` | **新增** 更新播放列表 | `UpdatePlaylistRequest` | `Playlist` |
| DELETE | `/api/playlists/:id` | **新增** 删除播放列表 | — | `{ success: boolean }` |
| PUT | `/api/playlists/:id/tracks` | **新增** 添加/移除曲目 | `{ trackId, action }` | `Playlist` |

### 9.2 Worker 路由映射结构

```typescript
// worker/routes.ts
const routes: Record<string, RouteHandler> = {
  'GET /list': handleList,
  'GET /api/artists': handleGetArtists,
  'GET /api/artists/:id': handleGetArtistDetail,
  'GET /api/search': handleSearch,
  'POST /api/playlists': handleCreatePlaylist,
  'GET /api/playlists': handleGetPlaylists,
  'GET /api/playlists/:id': handleGetPlaylist,
  'PUT /api/playlists/:id': handleUpdatePlaylist,
  'DELETE /api/playlists/:id': handleDeletePlaylist,
  'PUT /api/playlists/:id/tracks': handleModifyPlaylistTracks,
}
```

### 9.3 用户播放列表存储方案

**Phase A（本次实施）：** localStorage 前端存储
- 优点：零后端改动，立即实现
- 缺点：不同设备/浏览器不互通

**Phase B（后续）：** Worker + R2 存储
- 在 R2 中创建 `playlists/{userId}/{playlistId}.json`
- Worker 提供 CRUD API
- 用户标识：生成 UUID 存 localStorage，首次访问时创建

---

## Phase 10: 关键 Composables

### 10.1 `useAudioPlayer.ts`

```typescript
// 封装 APlayer 操作，与 playerStore 交互
export function useAudioPlayer() {
  const playerStore = usePlayerStore()
  
  // 初始化 HLS：为每个 track 指定 type: 'hls'
  function buildAudioList(tracks: Track[]): APlayerAudio[]
  
  // 切换歌曲
  function switchTrack(index: number): void
  
  // 播放/暂停
  function togglePlay(): void
  
  // 获取播放进度
  const progress = computed(() => ...)
  
  return {
    buildAudioList,
    switchTrack,
    togglePlay,
    progress,
    // ...
  }
}
```

### 10.2 `usePlaylist.ts`

```typescript
export function usePlaylist() {
  const playlistStore = usePlaylistStore()
  const playerStore = usePlayerStore()
  
  // 播放整个播放列表
  function playPlaylist(playlist: Playlist, startIndex?: number): void
  
  // 播放艺人全部歌曲
  function playArtist(artistId: string): void
  
  // 添加到当前队列
  function addToQueue(track: Track): void
  
  // 创建新播放列表
  async function createNewPlaylist(name: string): Promise<Playlist>
  
  return { playPlaylist, playArtist, addToQueue, createNewPlaylist }
}
```

### 10.3 `useLocalStorage.ts`

```typescript
// 将 localStorage 封装为响应式 ref
export function useLocalStorage<T>(key: string, defaultValue: T): Ref<T>
```

---

## Phase 11: 样式方案

### 11.1 CSS 变量体系 (`variables.css`)

```css
:root {
  /* 主色调 */
  --color-primary: #1DB954;        /* Spotify 绿 */
  --color-primary-hover: #1ed760;
  --color-primary-active: #169c46;
  
  /* 背景 */
  --bg-primary: #121212;           /* 深色背景 */
  --bg-secondary: #1e1e1e;         /* 卡片/面板 */
  --bg-tertiary: #282828;          /* 悬停 */
  --bg-elevated: #333333;          /* 浮层 */
  
  /* 文字 */
  --text-primary: #ffffff;
  --text-secondary: #b3b3b3;
  --text-tertiary: #727272;
  
  /* 布局 */
  --header-height: 64px;
  --footer-height: 80px;
  --sidebar-width: 280px;
  --content-max-width: 1200px;
  
  /* 间距 */
  --spacing-xs: 4px;
  --spacing-sm: 8px;
  --spacing-md: 16px;
  --spacing-lg: 24px;
  --spacing-xl: 32px;
  
  /* 圆角 */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-full: 9999px;
  
  /* 阴影 */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.3);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.4);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.5);
  
  /* 过渡 */
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
}
```

### 11.2 响应式断点

```css
/* Mobile First */
/* sm: 640px  - 平板竖屏 */
/* md: 768px  - 平板横屏 */
/* lg: 1024px - 桌面 */
/* xl: 1280px - 宽屏 */
```

---

## Phase 12: Vite 配置

### `vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  },
  server: {
    port: 3000,
    // 代理 Worker API 到本地 wrangler dev 或生产
    proxy: {
      '/api': {
        target: 'https://music-proxy.osmanfeng.workers.dev',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['vue', 'vue-router', 'pinia'],
          'player': ['aplayer', 'hls.js']
        }
      }
    }
  }
})
```

---

## Phase 13: 部署配置

### 13.1 `wrangler.toml` 更新

```toml
name = "music-proxy"
main = "worker/index.ts"
compatibility_date = "2026-07-16"

[[r2_buckets]]
binding = "MUSIC"
bucket_name = "music-bucket"

# 新增：KV 命名空间（用于用户播放列表）
# [[kv_namespaces]]
# binding = "PLAYLISTS"
# id = "xxx"
```

### 13.2 GitHub Actions CI/CD (`.github/workflows/deploy.yml`)

```yaml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npm run build          # tsc + vite build → dist/
      - uses: cloudflare/pages-action@v1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: yuanfang-music-player
          directory: dist
          gitHubToken: ${{ secrets.GITHUB_TOKEN }}

  deploy-worker:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'
      - run: npm ci
      - run: npx wrangler deploy worker/index.ts
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

### 13.3 `package.json` scripts 更新

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "lint": "eslint src --ext .vue,.ts --fix",
    "format": "prettier --write src/",
    "test": "vitest run",
    "test:watch": "vitest",
    "worker:dev": "wrangler dev worker/index.ts",
    "worker:deploy": "wrangler deploy worker/index.ts",
    "generate:playlist": "tsx scripts/list-r2.ts",
    "deploy:all": "npm run build && npm run worker:deploy"
  }
}
```

---

## Phase 14: 安全修复

### 14.1 移除硬编码凭证

`scripts/list-r2.ts` 改为从环境变量读取：

```typescript
// 使用环境变量而非硬编码
const config = {
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!
  }
}
```

在项目根目录创建 `.env.example`：
```
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key_id
R2_SECRET_ACCESS_KEY=your_secret_access_key
```

`.gitignore` 中确认包含 `.env`。

---

## Phase 15: 实施顺序

### 第 1 天：脚手架 + 类型 + 路由
1. ✅ Vite + Vue 3 项目初始化
2. ✅ 安装所有依赖
3. ✅ `tsconfig.json` / `vite.config.ts` 配置
4. ✅ 创建完整目录结构
5. ✅ 编写所有 TypeScript 类型定义 (`src/types/`)
6. ✅ 配置 Vue Router (`src/router/index.ts`)
7. ✅ 创建布局组件 (`AppLayout`, `AppHeader`, `AppSidebar`, `AppFooter`)
8. ✅ 创建占位页面 (HomeView, BrowseView, ArtistView, etc.)
9. ✅ 验证：`npm run dev` 能启动，路由跳转正常

### 第 2 天：状态管理 + API 层
10. ✅ 实现 `src/utils/storage.ts` 和 `src/utils/constants.ts`
11. ✅ 实现 `src/services/api.ts` 基础封装
12. ✅ 实现 `src/services/music.ts`
13. ✅ 实现 Pinia stores：`player.ts`, `playlist.ts`, `user.ts`, `search.ts`
14. ✅ 实现 composables：`useLocalStorage.ts`
15. ✅ 验证：stores 单元测试通过，能成功 fetch 数据

### 第 3 天：播放器组件
16. ✅ 封装 `MusicPlayer.vue`（APlayer 集成）
17. ✅ 实现 `PlayerControls.vue`
18. ✅ 实现 `LyricsPanel.vue`
19. ✅ 实现 `PlaylistPanel.vue` + `PlaylistItem.vue`
20. ✅ 实现 `useAudioPlayer.ts` composable
21. ✅ 验证：能播放音乐，播放列表可见，歌词显示正常

### 第 4 天：业务页面
22. ✅ 实现 `HomeView.vue`（最近播放 + 推荐）
23. ✅ 实现 `BrowseView.vue` + `ArtistList.vue` + `ArtistCard.vue`
24. ✅ 实现 `ArtistView.vue`（艺人详情 + 全部歌曲）
25. ✅ 实现 `SearchView.vue` + `SearchBar.vue` + `SearchResults.vue`
26. ✅ 验证：浏览、搜索、播放流程通畅

### 第 5 天：用户播放列表 + 我的
27. ✅ 实现 `MyPlaylists.vue`
28. ✅ 实现 `PlaylistView.vue`
29. ✅ 实现 `usePlaylist.ts` composable
30. ✅ 实现 `SettingsView.vue`
31. ✅ 通用组件：`LoadingSpinner`, `ErrorMessage`, `EmptyState`
32. ✅ 验证：能创建/编辑/删除自定义播放列表

### 第 6 天：Worker 重构 + 部署
33. ✅ 重构 `worker/index.ts`（TypeScript）
34. ✅ 实现 Worker 新路由：`/api/artists`, `/api/search`, `/api/playlists/*`
35. ✅ 重写 `scripts/list-r2.ts`（安全修复）
36. ✅ 更新 `wrangler.toml`
37. ✅ 更新 CI/CD 配置
38. ✅ 更新 `README.md`
39. ✅ 最终验证：全流程测试 + 部署到 Cloudflare

---

## Phase 16: 测试策略

### 单元测试 (Vitest)

| 测试目标 | 文件 |
|----------|------|
| pinia stores | `src/stores/*.test.ts` |
| composables | `src/composables/*.test.ts` |
| 工具函数 | `src/utils/*.test.ts` |
| API 封装 | `src/services/*.test.ts` |

### 组件测试

| 关键组件 | 测试要点 |
|----------|----------|
| `MusicPlayer.vue` | APlayer 初始化、事件绑定 |
| `SearchBar.vue` | v-model、搜索触发、防抖 |
| `PlaylistPanel.vue` | 列表渲染、选择事件 |
| `LyricsPanel.vue` | LRC 解析、高亮滚动 |

---

## Phase 17: 兼容 & 迁移

### 保留旧文件（标记为 legacy）
- 原 `index.html` → `index.legacy.html`（备份）
- 原 `worker.js` → 保留直到 `worker/index.ts` 验证通过
- `playlist.json` → 继续使用直到 Worker `/list` API 验证通过

### 新旧协作
- 新旧系统共用同一个 R2 bucket 和 Cloudflare Pages 项目
- 前端一次性切换到 Vue 版本（不需要渐进迁移，因为用户无感知）
- `playlist.json` 作为启动数据冷备保留

---

## Verification

1. **开发环境验证：**
   - `npm run dev` → 浏览器打开 localhost:3000
   - 首页加载，显示艺人列表和播放列表
   - 点击歌曲 → APlayer 播放 → hls.js 正常加载 m3u8
   - 搜索功能正常
   - 创建自定义播放列表 → 刷新后恢复（localStorage）
   - 歌词面板正常显示

2. **构建验证：**
   - `npm run build` → 无 TS 错误，dist/ 产出正常
   - `npm run preview` → 构建产物在本地预览正常

3. **Worker 验证：**
   - `npm run worker:dev` → wrangler 本地调试
   - 所有 API 端点返回预期数据

4. **部署验证：**
   - `git push main` → GitHub Actions 自动部署
   - Cloudflare Pages 更新 → 浏览器访问正常
   - Worker 新版本上线 → API 调用正常

---

## Phase 18: 潜在风险 & 应对

| # | 风险 | 影响 | 应对措施 |
|---|------|------|----------|
| 1 | **APlayer + hls.js 兼容性** | APlayer 非为 HLS 设计，`ap.audio` 可能在 `listswitch` 事件时尚未就绪 | 使用 100ms `setTimeout` 延迟 + `MutationObserver` fallback；Safari 浏览器走原生 HLS |
| 2 | **Track ID 稳定性** | 用户播放列表基于 `hashUrl()` 生成的 ID，R2 结构变更会导致引用断裂 | 播放前校验 ID 是否在 library 中存在；缺失的显示"曲目不可用" |
| 3 | **大播放列表性能** | APlayer v1 在 250+ 首时可能有性能问题 | 必要时分页/虚拟滚动；`manualChunks` 分离 player 代码 |
| 4 | **URL 编码问题** | 当前 URL 含 `%28`, `%29` 等编码字符，proxy 路由需正确编解码 | 使用 `decodeURIComponent`（当前代码已正确） |
| 5 | **中文文件名乱码** | 如 `DJ ����` 等编码 artifacts | 前端 parser 正确处理 UTF-8 |
| 6 | **用户播放列表数据丢失** | localStorage 清空后列表消失 | 后续 Phase B 实现 Worker + R2 云端同步 |

## Phase 19: 歌词支持 (Lyrics Integration)

### 19.1 歌词文件存储与索引

在 R2 中为每首歌存储对应的 LRC 格式歌词文件，路径约定：

```
music-bucket/
├── 艺人A/
│   └── 歌曲名/
│       ├── playlist.m3u8
│       ├── segment-*.ts
│       └── lyrics.lrc          ← 新增歌词文件
```

`list-r2.cjs` 扫描时检测 `lyrics.lrc` 文件，将 `lyricsUrl` 写入 `playlist.json`：

```typescript
interface Track {
  // ...
  lyricsUrl?: string   // Worker 代理 URL 指向 lyrics.lrc
}
```

### 19.2 歌词解析器 (`src/utils/lyrics.ts`)

```typescript
export interface LyricLine {
  time: number    // 毫秒
  text: string
}

export function parseLRC(lrcText: string): LyricLine[] {
  // 解析 [mm:ss.xx] 格式的时间轴
  // 按时间排序，过滤空行
  // 返回有序的歌词行数组
}
```

### 19.3 歌词面板组件 (`LyricsPanel.vue`)

已有组件骨架，需完善：

| 功能 | 状态 |
|------|------|
| 从 `track.lyricsUrl` 加载 LRC 文件 | ⬜ 待实现 |
| `parseLRC()` 解析歌词文本 | ⬜ 需实现 `src/utils/lyrics.ts` |
| 根据 `currentTime` 高亮当前行 | ⬜ 待完善 |
| 自动滚动的当前行 | ⬜ 待完善 |
| 无歌词时的空状态显示 | ⬜ 待完善 |

### 19.4 集成到播放器

```
MusicPlayer.vue
  ↓ 监听 timeupdate
LyricsPanel.vue
  ↓ 通过 props 接收 currentTime + lyricsUrl
  ↓ 高亮 + 滚动
```

### 19.5 歌词上传工具

创建 `scripts/upload-lyrics.cjs`，支持批量上传 LRC 文件到 R2 并更新 `playlist.json`。

---

## Phase 20: 自定义播放列表云端同步

### 20.1 现状

当前播放列表存储在 `localStorage`，清空浏览器数据或更换设备后列表丢失。

### 20.2 Worker API 扩展

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/playlists` | 创建播放列表 |
| `GET` | `/api/playlists` | 获取用户所有播放列表 |
| `GET` | `/api/playlists/:id` | 获取单个播放列表详情 |
| `PUT` | `/api/playlists/:id` | 更新播放列表（名称、描述、曲目） |
| `DELETE` | `/api/playlists/:id` | 删除播放列表 |
| `PUT` | `/api/playlists/:id/tracks` | 添加/移除曲目 |

### 20.3 用户标识方案

```typescript
// 首次访问时生成 UUID 存 localStorage
const userId = localStorage.getItem('ym:userId') || generateUUID()
// 后续所有 API 请求通过 Header 携带
headers: { 'X-User-Id': userId }
```

### 20.4 数据存储

**Phase A（当前）：** localStorage 前端存储

**Phase B（本次实施）：** Worker + R2 存储
- R2 Key 格式：`playlists/{userId}/{playlistId}.json`
- Worker 提供完整 CRUD API
- 前端通过 API 调用，localStorage 作为离线缓存

### 20.5 数据同步策略

```
写入: 前端 → API → R2 (同时写入 localStorage 作为缓存)
读取: 优先从 API 获取 → 失败时降级到 localStorage
同步: 启动时检测 localStorage 是否有未同步的更改 → 推送到云端
```

### 20.6 前端 Store 修改

`src/stores/playlist.ts` 中 `createPlaylist` / `updatePlaylist` / `deletePlaylist` 方法增加 API 调用：

```typescript
async function createPlaylist(name: string, description?: string): Promise<Playlist> {
  // 1. 调用 POST /api/playlists
  // 2. 成功后更新本地 store
  // 3. 失败时降级为 localStorage 存储 + 标记待同步
}
```

---

## Phase 21: 移动端体验优化

### 21.1 现状问题

| 问题 | 描述 |
|------|------|
| 侧边栏 | 桌面端在 `<768px` 宽度仍占位 280px |
| 播放器 | APlayer 在手机屏幕上过宽，控制按钮太小 |
| 字体大小 | 整体偏小，不适合触屏操作 |
| 触摸事件 | 未针对滑动、长按等手势优化 |
| PWA | 未支持添加到主屏幕、离线播放 |

### 21.2 响应式布局改进

```css
/* 断点策略 - Mobile First */
/* 默认: 手机 (<640px) */
/* sm: 640px+  - 平板竖屏 */
/* md: 768px+  - 平板横屏 */
/* lg: 1024px+ - 桌面 */

/* 移动端隐藏侧边栏，改为底部导航或抽屉 */
@media (max-width: 767px) {
  .sidebar { display: none; }
  .bottom-nav { display: flex; }  /* 底部 TabBar */
}
```

### 21.3 布局调整

```
桌面端:                   移动端:
┌─────┬──────────────┐   ┌──────────────┐
│     │  AppHeader    │   │  AppHeader   │
│     │  (搜索/设置)  │   │  (搜索/设置) │
│     ├──────────────┤   ├──────────────┤
│侧边栏│  router-view │   │  router-view │
│     │  (内容区)     │   │  (全屏内容)  │
│     │               │   │              │
├─────┴──────────────┤   ├──────────────┤
│  AppFooter / 播放器 │   │  播放器迷你条 │
└────────────────────┘   └──────────────┘
                          ┌──────────────┐
                          │  底部导航栏   │
                          │ 首页 浏览 我的│
                          └──────────────┘
```

### 21.4 移动端组件改造

**AppSidebar.vue** — 改为从右侧滑出的 Drawer：

```typescript
// 全屏遮罩 + 滑动面板
// 支持触摸滑动关闭
// 显示当前播放队列 + 播放列表入口
```

**MusicPlayer.vue** — 增加迷你模式：

```typescript
// 页面底部固定条：封面缩略图 + 歌名 + 播放/暂停按钮
// 点击展开全屏播放页
// 支持锁屏控制（Media Session API）
```

**PlaylistItem.vue** — 触控优化：

```typescript
// 增大点击热区（至少 44px）
// 左滑显示「添加到队列」
// 右滑显示「收藏」
```

### 21.5 PWA 支持

```bash
npm install vite-plugin-pwa -D
```

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

plugins: [
  VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: '远方音乐',
      short_name: '远方音乐',
      description: '在线 HLS 音乐播放器',
      theme_color: '#1DB954',
      icons: [...]
    }
  })
]
```

### 21.6 性能优化

| 优化项 | 说明 |
|--------|------|
| 图片懒加载 | 艺人封面懒加载，IntersectionObserver |
| 虚拟滚动 | 大播放列表（250+首）使用虚拟滚动 |
| 代码分包 | 移动端优先加载首屏，APlayer/hls.js 懒加载 |
| 字体压缩 | 仅保留中文常用字，减少字体文件体积 |
| Service Worker | 缓存 playlist.json 和静态资源 |

---

## Phase 22: Worker 自定义域名迁移

### 22.1 背景

`*.workers.dev` 域名在中国大陆网络环境下无法直接访问，需绑定自定义域名。

### 22.2 配置步骤

1. 在 Cloudflare Dashboard → Workers & Pages → `music-proxy` → Triggers → Custom Domains
2. 添加 `api.yuanfangorganics.ccwu.cc`
3. 更新前端代码中所有 `WORKER_BASE_URL`

### 22.3 受影响文件

| 文件 | 内容 |
|------|------|
| `src/utils/constants.ts` | `WORKER_BASE_URL` 常量 |
| `list-r2.cjs` | `playlist.json` 中的 URL 前缀 |
| `playlist.json` | 262 条曲目 URL |
| `vite.config.ts` | 开发代理目标地址 |
| `src/stores/playlist.ts` | `fetchPlaylists()` 中的硬编码 URL |

---

## Phase 23: Bug 修复记录

### 23.1 播放器 HLS 修复

| 问题 | 原因 | 修复 |
|------|------|------|
| 单击不播放 | `PlaylistItem.vue` 使用 `@dblclick` | 改为 `@click` |
| HLS 无法播放 | APlayer 构建音频列表时未传 `type: 'hls'` | 添加 `type: 'hls'` |
| `Hls is not defined` | APlayer 内部通过全局 `window.Hls` 引用 hls.js | `(window as any).Hls = Hls` |
| `output000.ts 404` | `encodeURIComponent` 把 `/` 编码为 `%2F` | `item.Key.split('/').map(encodeURIComponent).join('/')` |
| Worker 部署失败 | `compatibility_date` 过旧 | 更新到 `2026-07-21` |
| `list-r2.js` ESM 错误 | `package.json` 含 `"type": "module"` | 重命名为 `.cjs` |

---

## 附录：关键参数速查

| 参数 | 值 | 位置 |
|------|-----|------|
| Worker URL（生产） | `https://api.yuanfangorganics.ccwu.cc` | `src/utils/constants.ts`, `vite.config.ts` |
| Worker URL（回退） | `https://music-proxy.osmanfeng.workers.dev` | 需 VPN 访问 |
| R2 bucket | `music-bucket` | `wrangler.toml` |
| Worker name | `music-proxy` | `wrangler.toml` |
| Pages 自定义域 | `https://yuanfangorganics.ccwu.cc` | Cloudflare Dashboard |
| Pages 项目名 | `yuanfang-music` | `.github/workflows/deploy.yml` |
| Dev port | `3000` | `vite.config.ts` |
| 主题色 | `#1DB954` | `src/assets/styles/variables.css` |
| 歌词文件 | `lyrics.lrc` | R2 中与 playlist.m3u8 同级 |
| 用户标识 | UUID 存 `localStorage('ym:userId')` | Phase 20 实施 |
| 布局：header | `64px` | `variables.css` |
| 布局：footer | `80px` | `variables.css` |
| 布局：sidebar | `280px` | `variables.css` |
| 内容最大宽度 | `1200px` | `variables.css` |
| localStorage key 前缀 | `ym:` | `src/utils/constants.ts` |
| 最大播放历史 | `100` 首 | `src/stores/user.ts` |
| 搜索防抖 | `300ms` | `src/components/search/SearchBar.vue` |
| 音乐文件类型 | `hls` (m3u8 + ts) | `src/types/music.ts` |
| 分页大小 | `50` 首/页 | `src/utils/constants.ts` |
