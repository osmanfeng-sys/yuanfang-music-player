# yuanfang-music-player 架构与规划

> **最后更新：2026-10-12**
>
> 本文原名「全面重构实施计划」（2026-07-21，1668 行，Phase 1–23）。
> 那次重构**已经完成** —— Phase 1–18 的产物就是今天的代码，逐日排期、组件 Props/Emits 清单、
> 完整的类型与 store 代码片段都已随代码本身过时，本次一并删除。
>
> 现在它回答三个问题：**架构长什么样**、**当初为什么这么定**、**还有什么没做**。
>
> ```
> project-plan.md    全项目架构与剩余方向（本文）
> homepage-plan.md   主页（HomeView.vue）单视图现状与待办
> memory.md          运维记忆 —— 踩坑 / 部署流程 / 网络依赖（项目根，已 gitignore）
> ```
> **与代码冲突时以代码为准，并回头修文档。**

---

## 一、现状速览

| 项 | 值 |
|---|---|
| 前端 | Vue 3.4 + TypeScript 5.3 + Vite 5 + Pinia 2 + vue-router 4 |
| 播放内核 | APlayer 1.10（npm 包）+ hls.js 1.5 |
| 前端托管 | Cloudflare Pages，项目名 `yuanfang-music` |
| API | Cloudflare Worker，名 `music-proxy`，独立 TS 子项目（esbuild → `worker/dist/worker.js`） |
| 存储 | Cloudflare R2，bucket `music-bucket`，绑定名 `MUSIC` |
| 音频 | **393 首 mp3**（直传，非 HLS）；R2 无封面文件 |
| 歌词 | `lyrics/<trackId>.json`（271 个），另有索引 `playlist.json` + `durations.json` |
| CI/CD | GitHub Actions，push 到 main 即自动部署（`.github/workflows/deploy.yml`） |
| 仓库 | 公开：`osmanfeng-sys/yuanfang-music-player` |

**域名**

```
前端    https://yuanfangorganics.ccwu.cc        Pages 自定义域
API     https://api.yuanfangorganics.ccwu.cc    Worker 自定义域
API 回退 https://music-proxy.osmanfeng.workers.dev （需代理）
播客    https://yuanfangselect.ccwu.cc/         主页顶部「播客」按钮
```

> ⚠️ 这三个 `*.ccwu.cc` 域名的 SNI 在国内被点名阻断，**开着 Clash 时需要 WARP 出站才能访问**
> —— 配置在 Clash Verge 的 `Script.js`，全套机制见全局记忆 `network-notes.md`。

---

## 二、架构

### 2.1 前端分层

```
views/         页面，各自对应一条路由
  ↓
components/    可复用组件（layout 骨架 / player / playlist / search / artist / common）
  ↓
stores/        Pinia：player（播放状态）· playlist（曲库）· user（偏好）· search
  ↓
services/      api（fetch 封装）· music（曲库 API）· playlist（歌单 API）· lyrics（三级缓存）· prefetch
  ↓
utils/         constants · format · parser（文件名 → 歌手/歌名）
types/         music · playlist · api（+ index.ts barrel，`@/types` 全项目在用）
```

**`src/` 共 47 个文件**，最大的四个：

```
src/views/HomeView.vue              1002 行   主页，左右两栏（最大的单文件）
src/components/layout/AppFooter.vue  537 行   底部播放控制条（进度/音量/±15s/播放模式）
src/components/layout/AppHeader.vue  167 行   顶栏（Logo + 导航 + 主题 + 设置）
src/components/layout/AppLayout.vue  109 行   布局骨架 + 背景层（壁纸/封面模糊/纯黑）
```

### 2.2 布局骨架

```
.layout (fixed; inset:0; overflow:hidden)   ← 页面本身不滚动，滚动交给面板内部
├─ .layout__bg / .layout__bg-cover / .layout__scrim    三层背景
├─ AppHeader        顶栏
├─ .layout__content 绝对定位在顶栏与底栏之间
│   └─ <router-view>
└─ AppFooter        底部播放控制条
```

### 2.3 Cloudflare 侧

```
worker/src/
├─ index.ts              路由表（pattern + methods + handler 三元组，正则匹配 path）
├─ routes/  cors · list · proxy · artists · playlists · lyrics
├─ utils/   r2 · response · types
└─ （共 10 个文件 709 行）
```

| 端点 | 说明 |
|---|---|
| `GET /list` | 曲库索引（读 R2 `playlist.json`，经 `response.ts` 补齐 `id`/`album`/`type`） |
| `GET /proxy/*` | 音频流，**支持 HTTP Range**（206 / 416 / `Accept-Ranges`），mp3 靠它流式播放与 seek |
| `GET /api/artists` · `/api/artists/:id` | 艺人列表与详情（Worker 侧从曲库派生） |
| `GET /api/playlists*` | 用户歌单 **CRUD**（注意：前端接口已备，但无入口页面，见第五节） |
| `GET /api/lyrics/:key` | 读 `lyrics/<key>.json`，**只读** |

`public/_routes.json` 把 `/api/*`、`/list*`、`/proxy*` 交给 Worker，其余走 Pages 静态资源。

### 2.4 数据流要点

- **曲库**：Worker `/list` → `playlistStore`（`folders` 按曲目夹分组、`getTrackById`、`searchTracks`）
- **歌词**：云端 R2（人工核对，优先级最高）→ `localStorage('ym:lrc:<id>')` → lrclib.net 在线匹配；
  只在读，无写入接口（R2 上的歌词由 `upload-lyrics.mjs` 本机直写）
- **时长**：`/list` 不下发，由挂载后 6s 的 `fillDurations()` 后台补（延迟是故意的，避开首屏抢带宽）
- **历史/收藏**：`userStore` 存 localStorage（`playHistory` / `favorites` / `favoritePlaylists` / `lastSession`）

---

## 三、关键设计决策（保留「为什么」）

| 决策 | 为什么 |
|---|---|
| **整页重写为 Vue 3 + TS** | 原实现是单个 `index.html` 里 400+ 行混合 HTML/CSS/JS，无组件化、无类型、无状态管理、密钥硬编码 |
| **继续用 APlayer 而不是自研播放器** | 它有现成的列表/歌词/音量/进度 UI 与事件模型；自研的成本远高于改样式 |
| **APlayer 必须省略 `type: 'mp3'`** | APlayer 收到 `type:'mp3'` 会**静默不设 src**；省略 type 时它按 URL 自己判断。只有 HLS 才显式给 `type:'hls'` |
| **音频从 HLS 切片改为 mp3 直传** | HLS 要下载 m3u8 + 大量分片，在国内到 CF 的弱链路上起播要 1~2 分钟；mp3 + Range 一步到位 |
| **上传时剥掉 mp3 内嵌封面** | 封面（APIC）几百 KB 且在文件头部，浏览器要先越过它才能出声，直接毁掉「mp3 出声快」的收益 |
| **码率 ≤192 kbps** | 国内到 CF 实测约 50 KB/s，320 kbps 会卡 |
| **布局：全屏壁纸 + 玻璃面板 + 页面不滚动** | 对齐参考站 `music.mmp.cc`；所有内容悬浮在背景之上，滚动只发生在面板内部 |
| **主色红粉 `#ff5e5e`** | 同上，对齐参考站（原定绿色 `#1DB954` 已废弃） |
| **歌词三级缓存（云端 → 本地 → lrclib）** | 云端是人工核对过的、可信度最高，必须放最前才能让重新上传立即可见；lrclib 兜底覆盖长尾 |
| **Worker 独立 TS 子项目** | 与前端构建解耦（esbuild），`wrangler.toml` 的 `main` 指向构建产物；前端产物与 Worker 可各自部署 |
| **CF 自带 Git 集成已停用** | 它不构建、把仓库根当静态产物发布，push 后约 1 分钟线上是源码版（白屏）。靠 `deployments_enabled=false` 收敛成只有 CI 一条链路 |

---

## 四、日常流程

```bash
npm run dev                # 本地开发（Vite，端口 3000，/api 代理到线上 Worker）
npm run build              # vue-tsc --noEmit && vite build
npm run deploy:pages       # wrangler pages deploy dist
npm run worker:build       # cd worker && npm run build（esbuild）
npm run deploy:worker      # 构建 + wrangler deploy
npm test                   # vitest run
```

**曲库/歌词四条流程（顺序不可换）**

```bash
npm run music:upload -- ./music    # 1 传 mp3（递归扫描 music/）
npm run generate:playlist          # 2 扫 R2 重建 playlist.json（并同步到 R2）
npm run lyrics:upload -- ./music   # 3 传歌词（按 playlist.json 反查 trackId）
deploy-music.bat                   # 4 提交并推送（触发 CI 部署）
```

> `lyrics:upload` 靠 `playlist.json` 的曲目名反查 trackId，**第 2 步没跑，新歌的歌词全匹配不上**。

**网络依赖**：`wrangler` 推 CF API、`git push`、访问线上站点都需要代理或 WARP。
完整踩坑见 `memory.md` 与全局记忆 `network-notes.md`。

---

## 五、未实施 / 部分实施

### 5.1 用户歌单云端同步（原 Phase 20）—— **未实施**

现状：歌单存在 localStorage，清空浏览器数据或换设备即丢失。

### 5.1 用户歌单云端同步（原 Phase 20）—— **隔离已完成，入口仍缺**

**2026-10-12 已实施**：用户标识 + 数据隔离，方案 B（自定义 ID + 密码，前端派生 key）

```
用户设定     ID + 密码（自定义口令，不是账号）
前端派生     key = base64url(sha256("<ID>:<密码>")).slice(0, 22)     src/utils/userKey.ts
请求         X-User-Key: <key>                                       src/services/api.ts（统一注入）
Worker 存储  R2  user-playlists/<key>/index.json                     worker/src/routes/playlists.ts
```

设计要点：

- **22 位 base64url 是刻意的** —— 字符集天然路径安全，服务端只需一道格式正则，
  不必做 `../` 之类的穿越过滤（非法字符根本进不来）
- **密码不到服务端** —— 前端算完只发 key，Worker 侧零密码逻辑（无 salt / 无 401 流程 / 不落库）
- **按用户分片**顺带修掉了旧模型的**并发丢数据**：原来是所有歌单一个大数组、读全量改全量，
  两人同时建歌单会后写覆盖先写（R2 没有 CAS）。现在冲突面缩到单用户内
- 同时加固：`generateId()` 换成 `crypto.randomUUID()`（原实现 ≈31 bit 且带时间戳，可预测）、
  加限额（`name ≤ 60` / `description ≤ 200` / `trackIds ≤ 500`）
- 设置页新增「歌单同步」区块：ID + 密码 + 保存 + **指纹**（`fingerprint.slice(0, 8)`，
  用来在两台设备上核对是不是同一个身份）

> ⚠️ **威胁模型是「防误入 / 防随手翻」，不是防定向攻击。**
> `GET /api/playlists` 带候选 key 返回空数组还是非空就是一个 oracle，且没有限流 ——
> ID 已知 + 弱密码理论上可被在线爆破。UI 已强制密码 ≥ 8 位；
> 要真正防定向攻击需要服务端存凭据 hash + PBKDF2 + 限流，那是「账号系统」（方案 C）的量级，当前不做。

**剩余缺口：入口页面**

```
/playlist/:id 有路由有组件，全仓仍没有一处链接或 router.push 指向它
```

歌单前端代码全部保留（`services/playlist.ts` · `types/playlist.ts` · `composables/usePlaylist.ts` ·
`views/PlaylistView.vue` · `components/playlist/` 三个组件），下一步补入口即可用。

**已决定不做内容隔离**：`/proxy/*` 无鉴权且带 `Access-Control-Allow-Origin: *`，
任何访客（甚至不登录）都能播放全部 393 首。**用户隔离的只是「我的歌单列表」，不是「我能听哪些歌」。**
要给音频加鉴权的话，`<audio>` 无法携带自定义请求头（只能用 Cookie 或签名 URL），
且 Range / 缓存逻辑要全部重做，成本高一个量级。

### 5.2 测试（原 Phase 16）—— **几乎未实施**

原计划覆盖 stores / composables / utils / services + 4 个关键组件。
实际只有 `src/stores/playlist.test.ts`（77 行）一个文件。
`npm test` 可用，但覆盖率接近于零。

### 5.3 PWA（原 Phase 21.5）—— **未实施**

`public/` 里没有 manifest、没有 service worker，不支持加到主屏与离线播放。

### 5.4 移动端（原 Phase 21）—— **已实施，但方案与原计划完全不同**

原计划的断点策略是 Mobile First 的 `640 / 768 / 1024`，实际用的是 **max-width 降级**：

```
≤900px   右侧播放面板 → 全屏歌词浮层（顶栏「词」按钮开关）；隐藏专辑列
≤767px   底栏折成三行（曲目+音量 / 进度 / 控制居中）；--playerbar-height 88 → 120px
≤639px   隐藏歌手列；顶栏收紧
≤479px   隐藏音量滑块，只留静音按钮
```

同批落地的还有：进度条拖拽改 **Pointer Events + setPointerCapture**（原来用 mouse 事件，
触摸屏根本拖不动）、移动端滑块常显（触摸没有 hover，原来永远 `scale(0)`）、
新增快退/快进 15 秒。详见 `homepage-plan.md` 第六节。

### 5.5 Worker `workers.dev` 回退域（原 Phase 22）—— **部分**

自定义域名 `api.yuanfangorganics.ccwu.cc` 已绑定并在用。
`src/utils/constants.ts` 里记录了回退域 `music-proxy.osmanfeng.workers.dev`（需代理），
但代码里 `WORKER_BASE_URL` 是**硬编码常量、没有自动回退逻辑**。

---

## 六、原计划里有、现在没有的

按 2026-10-12 的清理结果（commit `f3cb9cc`，12 文件 / 675 行）：

| 原计划中的 | 现状 |
|---|---|
| `worker.js`（仓库根，1.9 KB） | **已删除** —— TS 重构验证早已通过，`wrangler.toml` 指向 `worker/dist/worker.js` |
| `AppSidebar.vue`（390 行）+ `--sidebar-width` | **已删除** —— 用户要求移除左侧菜单，变量也零引用 |
| `composables/useAudioPlayer.ts`（57 行） | **已删除** —— 零引用 |
| `composables/useLocalStorage.ts`（44 行） | **已删除** —— 零引用 |
| `utils/storage.ts`（55 行） | **已删除** —— 只被 barrel 转发，无人真用 |
| `composables|utils|services|stores` 四个 `index.ts` barrel | **已删除** —— importer 数均为 0（`@/types` 的 barrel 保留，22 个文件在用） |
| `PlayerControls.vue`（标注「可选，增强 APlayer 默认 UI」） | **从未创建** —— 播放控制实际在 `AppFooter.vue` |
| `--header-height` / `--footer-height` | 各剩 1 处引用；布局已改用 `--topbar-height` / `--playerbar-height` |
| `--content-max-width`（1200px） | **零引用**（遗留 token） |
| `PAGE_SIZE` 常量 | **零引用**（`SEARCH_DEBOUNCE_MS` / `MAX_HISTORY` 仍在用） |
| `src/assets/images/default-artist.svg` | **零引用**（未删，待确认） |
| HLS 相关的 `prefetch.ts` 预取 | **保留但实际空跑** —— 库全是 mp3，m3u8 分片预取对 mp3 URL 是空操作。hls.js 与 HLS 代码路径按决定保留（未来可能传 HLS 源） |

> 另：仓库根曾有一个 **12.9 MB 的 `FSY.png`**（零引用），已随 `f3cb9cc` 删除。
> 但它的 blob **仍在 git 历史里**，`git clone` 依旧会下载 —— 要真正瘦身得重写历史（未做）。

---

## 附录 A：关键参数速查（已按当前代码校正）

| 参数 | 值 | 位置 |
|---|---|---|
| Worker URL（生产） | `https://api.yuanfangorganics.ccwu.cc` | `src/utils/constants.ts`, `vite.config.ts` |
| Worker URL（回退） | `https://music-proxy.osmanfeng.workers.dev` | 仅注释记录，无回退逻辑 |
| R2 bucket / Worker 名 | `music-bucket` / `music-proxy` | `wrangler.toml` |
| Pages 项目名 / 自定义域 | `yuanfang-music` / `yuanfangorganics.ccwu.cc` | CF Dashboard |
| Dev 端口 | `3000`（`/api` 代理到线上 Worker） | `vite.config.ts` |
| 构建分包 | `vendor`(vue/router/pinia) + `player`(aplayer/hls.js) | `vite.config.ts` |
| **主题色** | `#ff5e5e`（**非**旧文档写的 `#1DB954`） | `variables.css` |
| 布局尺寸 | `--topbar-height: 56px` / `--playerbar-height: 88px`（≤767px 120px）/ `--page-gutter: 20px` | `variables.css` |
| **音频格式** | **mp3 直传 + HTTP Range**（**非** HLS 切片） | R2 + `worker/src/routes/proxy.ts` |
| 音频码率上限 | 192 kbps | 上传脚本约定 |
| **歌词文件** | `lyrics/<trackId>.json`（**非** `lyrics.lrc`） | R2 |
| trackId 生成 | `generateTrackId(name)`，hash **原始文件名**（含 `[mqms]` 后缀） | `worker/src/utils/response.ts` |
| localStorage 前缀 | `ym:` | `src/utils/constants.ts` |
| 最大播放历史 | 100 首 | `src/utils/constants.ts` |
| 搜索防抖 | 300 ms | `src/utils/constants.ts` |
| 用户标识 | `base64url(sha256("<ID>:<密码>"))` 前 22 位，随 `X-User-Key` 发送 | `src/utils/userKey.ts` |
| 歌单存储 | `user-playlists/<userKey>/index.json`（按用户分片） | `worker/src/routes/playlists.ts` |

## 附录 B：原 Phase 1–23 去向

留档，方便拿着 2026-07-21 那版的人对照：

| 原 Phase | 内容 | 现状 |
|---|---|---|
| 1–15 | 脚手架 / 类型 / 路由 / stores / 解析器 / APlayer 集成 / 组件树 / API 层 / Worker 重构 / composables / 样式 / Vite / 部署 / 安全修复 / 实施顺序 | **已完成**，产物即当前代码；本文按现状重述，不再逐步罗列 |
| 16 | 测试策略 | 几乎未实施 → 5.2 |
| 17 | 兼容 & 迁移（保留 legacy 文件） | **已完成**，legacy 文件已于 2026-10-12 删除 → 第六节 |
| 18 | 潜在风险 & 应对 | 已过期：APlayer listswitch 时序问题已修（改读事件参数而非 `ap.list.index`）；ID 稳定性、URL 编码、中文名乱码均已实测无问题 |
| 19 | 歌词支持 | **已完成**，但解析器实际在 `src/services/lyrics.ts`（非原计划的 `src/utils/lyrics.ts`） |
| 20 | 歌单云端同步 | **未实施** → 5.1 |
| 21 | 移动端体验优化 | **已实施但方案不同**；PWA 未做 → 5.4 / 5.3 |
| 22 | Worker 自定义域名迁移 | **已完成**；回退逻辑未做 → 5.5 |
| 23 | Bug 修复记录 | 已并入 `memory.md`（踩坑与历史 bug 的统一去处） |
