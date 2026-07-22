# 🎵 远方音乐播放器 (yuanfang-music-player)

> 基于 Cloudflare Pages + Worker + R2 的在线 HLS 音乐播放器 — Vue 3 + TypeScript 重构版

远方音乐播放器是一个**全栈无服务端架构**的在线音乐平台。音乐文件（HLS 格式，含 `.m3u8` + `.ts` 分片）存储在 Cloudflare R2 对象存储中，通过 Cloudflare Worker 进行反向代理和 API 服务，前端为 Vue 3 + TypeScript 单页应用，部署在 Cloudflare Pages 上。整套系统无需维护传统服务器，近乎零成本运行。

---

## ✨ 功能特性

| 特性 | 说明 |
|------|------|
| 🎧 **HLS 流式播放** | 基于 hls.js 的 HTTP Live Streaming 播放，支持高码率音频分片加载 |
| 📂 **按艺人浏览** | 自动解析曲目名称，按「艺人 — 歌曲」格式归类展示 |
| 🔍 **本地搜索** | 基于前端缓存的即时搜索，支持歌曲名/艺人名模糊匹配 |
| 📋 **自定义播放列表** | 创建、编辑、删除个人播放列表（localStorage 持久化） |
| 🔀 **多种播放模式** | 顺序播放、随机播放、单曲循环、列表循环 |
| 📜 **歌词同步显示** | LRC 格式歌词，自动解析时间轴并高亮当前行 |
| 🌙 **暗色主题** | 深色 UI 设计，护眼且富有沉浸感 |
| 📱 **响应式布局** | 桌面端侧边栏 + 移动端抽屉式导航，适配多端 |
| 🚀 **零服务端运维** | 全 Cloudflare 边缘网络部署，无需维护服务器 |
| 🤖 **CI/CD 自动部署** | GitHub Actions 推送即部署，前端 + Worker 分别发布 |

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                   用户浏览器 (Browser)                    │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │         Vue 3 SPA (Cloudflare Pages)             │   │
│  │                                                   │   │
│  │  Vue Router ──► 页面视图 (7 个路由页面)           │   │
│  │  Pinia Store ──► 状态管理 (4 个 Store)            │   │
│  │  APlayer + hls.js ──► HLS 音频播放               │   │
│  │  localStorage ──► 用户偏好 / 播放列表持久化       │   │
│  └──────────┬───────────────────────────────────────┘   │
│             │                                           │
│             │  fetch() / API                            │
└─────────────┼───────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────────────┐
│             Cloudflare Worker (Edge Network)             │
│                                                         │
│  /list      ──► 返回 playlist.json（全部曲目索引）      │
│  /*.m3u8    ──► 代理 R2 中的 HLS manifest 文件          │
│  /*.ts      ──► 代理 R2 中的 TS 音视频分片              │
│  /api/*     ──► (预留) 艺人/搜索/播放列表 CRUD API      │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              Cloudflare R2 (对象存储)                    │
│                                                         │
│  music-bucket/                                          │
│  ├── 艺人A/                                             │
│  │   ├── 歌曲a/playlist.m3u8                            │
│  │   ├── 歌曲a/segment-001.ts                           │
│  │   └── 歌曲a/segment-002.ts                           │
│  ├── 艺人B/                                             │
│  │   └── ...                                            │
│  └── playlist.json          ◄── 由 list-r2.js 自动生成  │
└─────────────────────────────────────────────────────────┘
```

### 数据流

1. **初始化**：前端访问 Cloudflare Pages 加载 SPA
2. **获取曲目**：`GET /list` → Worker 从 R2 读取 `playlist.json` → 返回 `Track[]`
3. **解析名称**：前端解析 `Artist - Title` 格式 → 构建艺人/歌曲索引
4. **播放音乐**：用户点击歌曲 → APlayer 加载 `.m3u8` URL → hls.js 接管 `<audio>` → 拉取 `.ts` 分片流式播放
5. **歌词**：如有歌词文件，自动请求并解析 LRC → 时间轴同步高亮

---

## 🛠️ 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| **前端框架** | Vue 3 (Composition API + `<script setup>`) | UI 组件化 |
| **语言** | TypeScript 5.3 | 类型安全 |
| **构建工具** | Vite 5 | 极速 HMR + 构建 |
| **路由** | Vue Router 4 | 页面导航 (7 个路由) |
| **状态管理** | Pinia 2 | 播放器/播放列表/用户/搜索状态 |
| **播放器** | APlayer 1.10 + hls.js 1.5 | HLS 音频流播放 |
| **工具库** | @vueuse/core | Composition API 工具集 |
| **CSS** | 原生 CSS + CSS Variables | 暗色主题 + 响应式 |
| **后端** | Cloudflare Worker (JavaScript) | R2 代理 + API 服务 |
| **存储** | Cloudflare R2 | 音乐文件 + 索引数据 |
| **部署** | Cloudflare Pages (前端) + Worker | 边缘网络托管 |
| **CI/CD** | GitHub Actions | 自动构建 + 部署 |
| **测试** | Vitest + @vue/test-utils | 单元测试 |
| **代码规范** | ESLint + Prettier + vue-tsc | 代码质量 |

---

## 📁 项目结构

```
yuanfang-music-player/
│
├── index.html                     # Vite 入口 HTML
├── vite.config.ts                 # Vite 构建配置（代理、分包策略）
├── tsconfig.json                  # TypeScript 主配置
├── tsconfig.node.json             # Node 环境 TypeScript 配置
├── package.json                   # 前端依赖 & 脚本
├── .env.example                   # 环境变量模板
├── .eslintrc.cjs                  # ESLint 配置
├── .prettierrc                    # Prettier 格式化配置
├── wrangler.toml                  # Cloudflare Worker 配置（绑定 R2 bucket）
├── deploy-code.bat                  # Windows 代码部署脚本（常用）
├── deploy-music.bat                 # Windows 音乐列表同步脚本
│
├── src/                           # ★ 前端源代码
│   ├── main.ts                    #   应用入口：挂载 App + Router + Pinia
│   ├── App.vue                    #   根组件
│   ├── env.d.ts                   #   环境类型声明
│   │
│   ├── router/
│   │   └── index.ts               #   Vue Router 配置（7 条路由 + 动态 title）
│   │
│   ├── stores/
│   │   ├── player.ts              #   播放器核心状态（队列、播放模式、音量）
│   │   ├── playlist.ts            #   播放列表管理（缓存、艺人索引、搜索）
│   │   ├── user.ts                #   用户偏好（主题、历史、收藏、会话恢复）
│   │   └── search.ts              #   搜索状态（查询词、结果、搜索历史）
│   │
│   ├── components/
│   │   ├── player/
│   │   │   ├── MusicPlayer.vue    #   APlayer 封装 + hls.js 接管
│   │   │   └── LyricsPanel.vue    #   歌词面板（LRC 解析 + 时间轴高亮）
│   │   ├── playlist/
│   │   │   ├── PlaylistPanel.vue  #   播放列表面板
│   │   │   ├── PlaylistItem.vue   #   列表项（当前播放/移除/添加到列表）
│   │   │   └── MyPlaylists.vue    #   用户自定义播放列表管理
│   │   ├── search/
│   │   │   ├── SearchBar.vue      #   搜索栏（300ms 防抖）
│   │   │   └── SearchResults.vue  #   搜索结果展示
│   │   ├── artist/
│   │   │   ├── ArtistList.vue     #   艺人网格列表
│   │   │   └── ArtistCard.vue     #   艺人卡片（含歌曲数、播放全部）
│   │   ├── layout/
│   │   │   ├── AppLayout.vue      #   整体布局容器（header + sidebar + content + footer）
│   │   │   ├── AppHeader.vue      #   顶部导航栏（Logo、导航、搜索、设置）
│   │   │   ├── AppSidebar.vue     #   侧边栏（桌面端，含播放队列快捷入口）
│   │   │   └── AppFooter.vue      #   底部固定播放条
│   │   └── common/
│   │       ├── LoadingSpinner.vue #   加载动画（sm/md/lg + 文字）
│   │       ├── ErrorMessage.vue   #   错误提示（支持重试按钮）
│   │       └── EmptyState.vue     #   空状态占位（图标 + 标题 + 操作按钮）
│   │
│   ├── views/
│   │   ├── HomeView.vue           #   首页：最近播放 + 推荐 + 快速入口
│   │   ├── BrowseView.vue         #   浏览：全部艺人列表
│   │   ├── ArtistView.vue         #   艺人详情：专辑 + 全部歌曲
│   │   ├── SearchView.vue         #   搜索结果页
│   │   ├── PlaylistView.vue       #   播放列表详情
│   │   ├── SettingsView.vue       #   设置页（主题、播放偏好）
│   │   └── NotFoundView.vue       #   404 页面
│   │
│   ├── services/
│   │   ├── api.ts                 #   API 基础封装（fetch + 超时 + 错误处理）
│   │   ├── music.ts               #   音乐相关 API（/list、艺人、搜索）
│   │   └── playlist.ts            #   播放列表 CRUD API
│   │
│   ├── types/
│   │   ├── music.ts               #   Track / Artist / Album 类型定义
│   │   ├── playlist.ts            #   Playlist / PlayMode 类型定义
│   │   └── api.ts                 #   API 请求/响应类型定义
│   │
│   ├── composables/
│   │   ├── useAudioPlayer.ts      #   音频播放逻辑封装（APlayer 操作）
│   │   ├── usePlaylist.ts         #   播放列表操作（播放/创建/加入队列）
│   │   └── useLocalStorage.ts     #   localStorage 响应式封装（Ref 双向绑定）
│   │
│   ├── utils/
│   │   ├── constants.ts           #   常量定义（Worker URL、key 前缀、分页大小）
│   │   ├── storage.ts             #   localStorage 通用封装
│   │   ├── parser.ts              #   Track 名称解析器（"Artist - Title" 格式）
│   │   └── format.ts              #   格式化工具（时间 mm:ss、文件大小等）
│   │
│   └── assets/
│       └── styles/
│           ├── variables.css      #   CSS 变量（主题色、间距、圆角、阴影）
│           └── global.css         #   全局样式重置 + 基础排版
│
├── worker/                        # ★ Cloudflare Worker 源码
│   ├── package.json               #   Worker 独立依赖（esbuild、workers-types）
│   ├── tsconfig.json              #   Worker TypeScript 配置
│   └── src/
│       ├── index.ts               #   Worker 入口（路由分发）
│       └── routes/                #   路由处理函数
│           ├── list.ts            #   GET /list — 返回曲目索引
│           ├── proxy.ts           #   GET /* — R2 文件代理
│           ├── playlists.ts       #   播放列表 CRUD
│           └── cors.ts            #   OPTIONS 预检请求处理
│
├── scripts/
│   └── list-r2.cjs                 # R2 扫描脚本（遍历 bucket → 生成 + 自动上传 playlist.json）
│
├── playlist.json                  # 音乐索引文件（由 list-r2.cjs 自动生成）
├── .env                           # 环境变量凭证（R2 + Cloudflare 密钥，不提交到 Git）
├── worker.js                      # Worker 旧版（JS 版本，保留备份）
│
└── .github/
    └── workflows/
        └── deploy.yml             # GitHub Actions 自动部署流水线
```

---

## 🚀 快速开始

### 前置条件

- [Node.js](https://nodejs.org/) >= 18
- [npm](https://www.npmjs.com/) >= 9
- [Cloudflare 账号](https://dash.cloudflare.com/)（用于 Worker + R2 + Pages）
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)（通过 npm 全局安装，或使用 `npx wrangler`）

### 1. 克隆并安装依赖

```bash
git clone https://github.com/你的用户名/yuanfang-music-player.git
cd yuanfang-music-player
npm install
```

Worker 有独立的依赖，需要单独安装：

```bash
cd worker
npm install
cd ..
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env` 并填入你的 R2 凭证：

```bash
cp .env.example .env
```

编辑 `.env`：

```ini
# R2 存储桶配置（用于 list-r2.js 扫描生成 playlist.json）
R2_ENDPOINT=https://<你的account-id>.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=your_access_key_id_here
R2_SECRET_ACCESS_KEY=your_secret_access_key_here

# Cloudflare 部署配置（用于 wrangler CLI）
CLOUDFLARE_API_TOKEN=your_api_token_here
CLOUDFLARE_ACCOUNT_ID=your_account_id_here
```

> **⚠️ 安全提示**：`.env` 文件已包含在 `.gitignore` 中，切勿提交到 Git。R2 凭证（`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`）用于脚本扫描存储桶，Cloudflare API Token（`CLOUDFLARE_API_TOKEN`）用于 wrangler 部署。

### 3. 配置 R2 Bucket

在 [Cloudflare Dashboard → R2](https://dash.cloudflare.com/?to=r2) 创建一个 bucket（示例：`music-bucket`）。然后将你的音乐文件按以下结构上传：

```
music-bucket/
├── 艺人名A/
│   ├── 歌曲名1/
│   │   ├── playlist.m3u8      # HLS manifest
│   │   ├── segment-001.ts     # TS 分片
│   │   └── segment-002.ts
│   └── 歌曲名2/
│       └── playlist.m3u8
└── 艺人名B/
    └── ...
```

> **关于音乐格式**：项目使用 HLS（HTTP Live Streaming）格式。你可以使用 FFmpeg 将音频文件转换为 HLS：
> ```bash
> ffmpeg -i input.mp3 -codec: libmp3lame -qscale:a 2 -f hls -hls_time 10 -hls_list_size 0 playlist.m3u8
> ```
> 或使用 `.ts` 扩展名直接分片：`ffmpeg -i input.mp3 -c copy -f segment -segment_time 10 -segment_list playlist.m3u8 output%03d.ts`

### 4. 生成音乐索引

扫描 R2 bucket 中所有 `playlist.m3u8` 文件并生成索引：

```bash
npm run generate:playlist
```

这会在根目录生成 `playlist.json`，包含所有曲目的名称和 URL。

> **注意**：执行此脚本需要 `.env` 中的 `R2_ENDPOINT`、`R2_ACCESS_KEY_ID`、`R2_SECRET_ACCESS_KEY` 正确配置。

### 5. 配置 Cloudflare Worker

编辑 `wrangler.toml`，确保 R2 bucket 名称与你的 bucket 一致：

```toml
name = "music-proxy"
main = "worker/dist/worker.js"
compatibility_date = "2026-07-16"

[[r2_buckets]]
binding = "MUSIC"
bucket_name = "music-bucket"   # ← 改为你的 bucket 名称
```

### 6. 配置 Worker URL

前端通过 Worker URL 获取数据。打开 `src/utils/constants.ts`，确认 `WORKER_BASE_URL` 指向你的 Worker：

```typescript
// 生产环境：使用自定义域名（中国大陆可正常访问）
export const WORKER_BASE_URL = 'https://api.你的域名.ccwu.cc'
// 回退地址：https://music-proxy.你的用户名.workers.dev（需 VPN）
```

> ⚠️ `*.workers.dev` 域名在中国大陆被网络防火墙屏蔽。如果面向国内用户，请务必给 Worker 绑定自定义域名（如 `api.yourdomain.com`），否则用户需开 VPN 才能听歌。

`vite.config.ts` 中的开发代理也需要同步修改：

```typescript
proxy: {
  '/api': {
    target: 'https://api.你的域名.ccwu.cc',  // ← 改为你的 Worker 自定义域名
    changeOrigin: true
  }
}
```

### 7. 部署 Worker

```bash
# 构建 Worker（esbuild 打包）
npm run worker:build

# 部署 Worker 
npx wrangler deploy worker/dist/worker.js --name music-proxy
```

### 8. 本地开发

```bash
npm run dev
```

浏览器打开 `http://localhost:3000`，即可看到应用。

---

## 💻 开发指南

### 可用的 npm Scripts

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动 Vite 开发服务器（端口 3000，HMR 热更新） |
| `npm run build` | TypeScript 类型检查 + Vite 生产构建 → `dist/` |
| `npm run preview` | 本地预览生产构建产物 |
| `npm run generate:playlist` | 扫描 R2 bucket → 生成 `playlist.json` → **自动上传到 R2** |
| `npm run worker:build` | 用 esbuild 打包 Worker TypeScript 源码 |
| `npm run worker:dev` | 本地调试 Worker（wrangler dev） |
| `npm run deploy:pages` | 部署前端到 Cloudflare Pages |
| `npm run deploy:worker` | 构建并部署 Worker |
| `npm run deploy:local` | Windows 一键部署（旧版 deploy.bat） |
| `npm run lint` | ESLint 检查 + 自动修复 |
| `npm run format` | Prettier 格式化 |
| `npm run test` | 运行 Vitest 单元测试 |
| `npm run test:watch` | 监听模式运行测试 |

### 路由一览

| 路径 | 页面 | 说明 |
|------|------|------|
| `/` | 首页 | 最近播放 + 推荐曲目 + 快速入口 |
| `/browse` | 浏览 | 按艺人网格展示，可跳转艺人详情 |
| `/artist/:id` | 艺人详情 | 显示专辑 + 全部歌曲 + 一键播放全部 |
| `/search?q=xxx` | 搜索结果 | 前端本地模糊搜索，支持歌曲名/艺人名 |
| `/playlist/:id` | 播放列表 | 显示列表曲目 + 播放/编辑/删除 |
| `/settings` | 设置 | 主题切换（亮色/暗色/跟随系统） |
| `/*` | 404 | 未匹配路由显示友好提示 |

### 状态管理结构

```
Pinia Stores
├── playerStore        # 播放器核心（队列、当前曲目、播放状态、音量、模式）
├── playlistStore      # 曲目缓存、艺人索引、播放列表 CRUD、搜索
├── userStore          # 主题偏好、播放历史、收藏、会话恢复
└── searchStore        # 搜索词、结果、搜索历史
```

Store 之间通过 Pinia 的 `useXxxStore()` 相互调用，例如点击艺人歌曲时：

```
ArtistView.vue
  → playlistStore.fetchTracks()      # 获取/过滤该艺人曲目
  → playerStore.setQueue(tracks)     # 设置播放队列
  → playerStore.play(0)              # 开始播放第一首
  → userStore.addToHistory(trackId)  # 记录播放历史
```

### Track 名称解析规则

`playlist.json` 中的 `name` 字段有 3 种格式，解析器（`src/utils/parser.ts`）按以下优先级处理：

| 格式 | 示例 | 解析结果 |
|------|------|----------|
| `Artist - Title` | `Aqua - Barbie Girl` | `{ artist: "Aqua", title: "Barbie Girl" }` |
| `Artist- Title`（无空格） | `指南针(罗琦)- 不想再是小孩` | `{ artist: "指南针(罗琦)", title: "不想再是小孩" }` |
| 纯文本（无分隔符） | `与你到永久` | `{ artist: "Unknown", title: "与你到永久" }` |

同时自动清理 `[mqms2]` 等质量标记后缀。

### APlayer + hls.js 集成

这是项目中最关键的技术细节。APlayer v1 原生不支持 HLS（它内部使用 `<audio>` 元素），解决方案：

```
用户点击歌曲
  ↓
APlayer 触发 listswitch 事件
  ↓ 延迟 100ms 等待 DOM 就绪
获取 ap.audio (HTMLAudioElement)
  ↓ 判断 URL 是否为 .m3u8
  ├─ 是 → 创建 Hls 实例 → hls.loadSource(url) → hls.attachMedia(audio)
  └─ 否 → 原生 HLS（Safari）→ 直接设置 audio.src = url
  ↓
APlayer 开始播放
```

对应源码：`src/components/player/MusicPlayer.vue`

---

## 📦 部署

### 方式一：CI/CD 自动部署（推荐）

推送至 `main` 分支后，GitHub Actions 自动完成（**前后端串行部署**，避免限流）：

1. **前端**：`npm ci` → `npm run build` → Cloudflare Pages 部署
2. **Worker**（等前端完成）：构建 → `wrangler deploy`

GitHub Secrets 需要配置：

| Secret | 说明 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 令牌（需有 **Workers** + **Pages** + **R2** 编辑权限） |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 账户 ID |

> ⚠️ `CLOUDFLARE_API_TOKEN` 需要在 [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens) 中创建，权限至少包含 Workers Edit + Pages Edit。Token 创建后添加到 [GitHub Secrets](https://github.com/osmanfeng-sys/yuanfang-music-player/settings/secrets/actions)。

默认的 workflow 文件在 `.github/workflows/deploy.yml`。

### 方式二：手动部署

```bash
# 1. 构建前端
npm run build

# 2. 部署前端到 Pages
npx wrangler pages deploy . --project-name=yuanfang-music

# 3. 构建并部署 Worker
npm run worker:build
npx wrangler deploy worker/dist/worker.js --name music-proxy
```

### 方式三：Windows 部署脚本（推荐）

项目提供两个拆分脚本，按需使用：

---

**`deploy-code.bat` — 代码部署（最常用）**

当你改了前端/Worker 代码后使用。**不做音乐扫描，快。**

| 步骤 | 执行 | 说明 |
|------|------|------|
| 1/4 | `npm install` | 安装前端依赖 |
| 2/4 | `git add . → commit → pull --rebase → push` | 提交代码到 GitHub |
| 3/4 | `npm run build → wrangler pages deploy` | 构建前端 → 部署到 Cloudflare Pages |
| 4/4 | 进 `worker/` → `npm install + build → wrangler deploy` | 构建并部署 Worker |

**什么时候用：** 每次你改完代码，双击它就行。

**注意：** 步骤 2（Git push）会触发 GitHub Actions，Actions 也会自动走一遍部署。所以其实你也可以只 commit + push 到 GitHub，等 CI 自动部署，不需要本地跑 `deploy-code.bat`。

---

**`deploy-music.bat` — 音乐列表同步**

当你在 R2 存储桶里加了新歌/删了歌后使用。**不构建前端，不部署 Worker，速度快。**

| 步骤 | 执行 | 说明 |
|------|------|------|
| 1/2 | `npm run generate:playlist` | 扫描 R2 全部音频文件 → 生成 `playlist.json` → 上传回 R2 |
| 2/2 | `git add playlist.json → commit → push` | 把新的索引提交到 GitHub |

**什么时候用：** 你往 R2 上传了新歌之后双击它。

Git push 之后 GitHub Actions 会自动重新部署前端和 Worker，所以不需要额外操作。

---

## 🌐 API 参考

### Worker 端点

| 方法 | 路径 | 说明 | 响应 |
|------|------|------|------|
| `GET` | `/list` | 获取全部曲目索引 | `Track[]` |
| `GET` | `/*.m3u8` | 代理 HLS manifest 文件 | `application/vnd.apple.mpegurl` |
| `GET` | `/*.ts` | 代理 TS 音视频分片 | `video/MP2T` |
| `GET` | `/api/artists` | 获取艺人列表（预留） | `{ artists: Artist[] }` |
| `GET` | `/api/search?q=xxx` | 搜索曲目（预留） | `{ results: Track[] }` |
| `OPTIONS` | `*` | CORS 预检请求 | 204 + CORS headers |

> ⚠️ **中国大陆访问须知**：Worker API 通过 `api.yuanfangorganics.ccwu.cc` 访问（自定义域名），使用 Cloudflare 国内网络节点，无需 VPN。若直接访问 `*.workers.dev` 域名则需 VPN。

### 数据模型

```typescript
interface Track {
  id: string           // 唯一标识
  title: string        // 歌曲名（如 "Barbie Girl"）
  artist: string       // 艺人名（如 "Aqua"）
  album?: string       // 专辑名（可选）
  url: string          // Worker 代理 URL（指向 .m3u8 文件）
  cover?: string       // 封面图 URL
  lyricsUrl?: string   // 歌词文件 URL
  duration?: number    // 时长（秒）
  type: 'hls'          // 媒体类型
}
```

---

## 🧪 测试

```bash
# 运行所有测试
npm run test

# 监听模式
npm run test:watch
```

测试覆盖：
- **Pinia Stores**：播放器状态、播放列表 CRUD、用户偏好
- **Composables**：useLocalStorage、useAudioPlayer
- **工具函数**：名称解析器、格式化、常量
- **API 封装**：请求/响应处理、超时/错误场景
- **关键组件**：SearchBar（v-model + 防抖）、LyricsPanel（LRC 解析）

---

## ⚠️ 常见问题

### Q: 播放时没有声音 / 无法加载音乐？
**A**: 检查以下几点：
1. 确认 R2 bucket 中有正确的 `playlist.m3u8` 和 `.ts` 分片文件
2. 确认 Worker 已部署且 `wrangler.toml` 中的 bucket 名称正确
3. 浏览器控制台是否有 CORS 错误？Worker 已内置 CORS 头
4. Safari 浏览器使用原生 HLS 支持，无需 hls.js

### Q: `playlist.json` 中的艺人名称显示为 "Unknown"？
**A**: 文件名不符合 `Artist - Title` 格式。检查 R2 中的文件路径是否使用了 `- `（连字符 + 空格）分隔艺人名和歌曲名。

### Q: 本地开发时无法获取数据？
**A**: 确认 `src/utils/constants.ts` 中的 `WORKER_BASE_URL` 指向你的 Worker 地址，且 Worker 已部署并可访问。开发模式下也可以先 run `wrangler dev worker.js` 在本地启动 Worker。

### Q: 在中国大陆必须开 VPN 才能访问？
**A**: 这是因为 `workers.dev` 域名在中国大陆被网络防火墙屏蔽。项目的 Worker API 默认使用 `*.workers.dev` 域名，导致无法访问。解决方案：

1. **给 Worker 绑定自定义域名**（推荐）：在 Cloudflare Dashboard → Workers & Pages → `music-proxy` → Triggers → Custom Domains，添加 `api.yuanfangorganics.ccwu.cc`（或你域名的子域名）
2. **更新前端代码**：修改 `src/utils/constants.ts` 中的 `WORKER_BASE_URL` 为自定义域名
3. **重新生成 `playlist.json`**：`npm run generate:playlist` 并上传到 R2

绑定自定义域名后，Worker API 走 Cloudflare 的国内网络节点，无需 VPN 即可正常访问。

### Q: 部署后页面白屏 / 404？
**A**: Cloudflare Pages 是 SPA，需要配置自定义 404 页面指向 `index.html`。在 Pages 项目设置 → 路由中，添加 `/_redirects` 规则：
```
/*    /index.html    200
```

### Q: 如何更新音乐库？
**A**: 在 R2 bucket 中添加/删除音乐文件后，二选一：
- **Windows**：双击 `deploy-music.bat`（扫描 R2 → 生成索引 → 上传 → 推 Git，触发 CI 自动部署）
- **命令行**：
  ```bash
  npm run generate:playlist
  git add playlist.json && git commit -m "update playlist" && git push
  ```
  GitHub Actions 会自动构建 + 部署前端和 Worker。

### Q: 艺人卡片没有图片，只有默认图标？
**A**: 当前版本使用 SVG 绘制的默认艺人头像（绿色渐变背景 + 音符+人形图标）。未来版本会支持艺人自定义封面，存储在 R2 中自动显示。

### Q: 进度条不能拖动？
**A**: 这是项目初期的 CSS 覆盖问题。如果进度条无法拖动，检查 `src/components/player/MusicPlayer.vue` 中有没有 `cursor: pointer` 相关的样式被覆盖。最新代码已修复此问题。

### Q: `npm run generate:playlist` 报 `require is not defined`？
**A**: `package.json` 中设置了 `"type": "module"`，导致 `.js` 文件被当作 ES Module 处理。脚本已重命名为 `list-r2.cjs` 解决。如果本地有旧文件，请删除 `list-r2.js`。

---

## 🔮 未来规划

项目基于 [project-plan.md](./project-plan.md) 已完成 Vue 3 + TypeScript 重构，后续计划：

- [ ] **歌词同步显示**（Phase 19）：从 R2 加载 LRC 歌词文件，解析时间轴，高亮当前行 + 自动滚动
- [ ] **自定义播放列表云端同步**（Phase 20）：Worker + R2 存储，跨设备同步，localStorage 离线降级
- [ ] **移动端体验优化**（Phase 21）：响应式布局重构、底部导航栏、迷你播放器、PWA 支持、触控手势
- [ ] **专辑浏览**：按专辑分类展示曲目
- [ ] **键盘快捷键**：空格播放/暂停、方向键切歌
- [ ] **更多音质选择**：支持多码率 HLS 切换

---

## 📋 最近更新记录

### 2026-07-21 — 播放器修复 + 自定义域名 + 郑源精选

| 类别 | 改动 | 说明 |
|------|------|------|
| 🐛 **播放器修复** | `AbortError` 竞态 | 新增 `_ignorePause` 标志，队列重建时忽略 APlayer 内部 pause 事件 |
| 🐛 **播放器修复** | 进度条拖动 | 修复 CSS `cursor: pointer`，thumb 增加放大效果 |
| 🐛 **播放器修复** | 上一曲/下一曲 | `next()`/`prev()` 改用 APlayer 原生 `skipForward()`/`skipBack()` |
| 🐛 **播放器修复** | `Hls is not defined` | 挂载 `window.Hls = Hls` 供 APlayer 内部引用 |
| 🐛 **Worker 修复** | `output000.ts 404` | URL 分段编码避免 `%2F` 问题 |
| 🐛 **Worker 修复** | Worker 不响应 | 更新 `compatibility_date` 为 `2026-07-21` |
| 🐛 **脚本修复** | `require is not defined` | `list-r2.js` → `list-r2.cjs` |
| 🌏 **中国大陆访问** | 自定义域名 | API 改用 `api.yuanfangorganics.ccwu.cc`，绕过 workers.dev 封锁 |
| 🔄 **一键更新** | 自动上传 R2 | `npm run generate:playlist` 扫描 → 生成 → 自动上传 R2 |
| 🤖 **CI/CD** | 前后端串行部署 | 改为 `needs: deploy-frontend` 按序执行，避免限流 |
| 🎤 **郑源精选** | 首页默认歌单 | 首页新增郑源精选板块（15 首歌）+ "播放全部"按钮 |
| 🎨 **艺人头像** | 默认 SVG 图标 | 绿色渐变 + 音符 + 人形，替换灰色剪影 |
| 📋 **项目计划** | 新增 3 个 Phase | 歌词支持、云端播放列表、移动端优化 |

---

## 📄 许可证

本项目仅供个人学习研究使用。音乐文件的版权归各自版权持有人所有。

---

## 🤝 贡献

欢迎 Issue 和 PR！如果发现 bug 或有功能建议，请先查看 [project-plan.md](./project-plan.md) 了解项目规划方向。

---

*Made with ❤️ and Vue 3 + Cloudflare*
