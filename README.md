# 🎵 远方音乐播放器 (yuanfang-music-player)

> 全栈无服务端在线 HLS 音乐播放器 — Vue 3 + TypeScript + Cloudflare（Pages / Worker / R2）

个人自用的在线音乐站。音乐以 HLS 分片存于 Cloudflare R2，Worker 做代理与 API，前端是 Vue 3 单页应用跑在 Cloudflare Pages 上。没有传统服务器，无运维成本。

**最后更新：2026-10-09**

---

## 🌐 线上地址与资源清单

| 用途 | 地址 / 名称 |
|------|------|
| 前端主站（推荐用这个） | https://yuanfangorganics.ccwu.cc |
| 前端 Pages 默认域名 | https://yuanfang-music.pages.dev |
| API（Worker 自定义域名） | https://api.yuanfangorganics.ccwu.cc |
| API 备用地址（大陆需代理） | https://music-proxy.osmanfeng.workers.dev |
| 播客站点（外链，非本项目） | https://yuanfangselect.ccwu.cc/ |
| GitHub 仓库（**公开**） | https://github.com/osmanfeng-sys/yuanfang-music-player |
| Pages 项目名 | `yuanfang-music` |
| Worker 名 | `music-proxy` |
| R2 存储桶 | `music-bucket`（Worker 内绑定名 `MUSIC`） |
| Cloudflare 账号 ID | `d3aaa017897b99e5387bffd8208e3967` |

### 账号与登录入口

| 平台 | 账号 | 登录地址 |
|------|------|----------|
| GitHub | `osmanfeng-sys` | https://github.com/login |
| Cloudflare | 账号 ID 见上表 | https://dash.cloudflare.com/login |

> ⚠️ **本文件在公开仓库里，不放任何密码、邮箱、API Token。**
> 所有凭证只存在于本机 `.env`（已在 `.gitignore` 中）：
> `R2_ENDPOINT` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`。
> CI 用的两份密钥存在 GitHub Secrets（同名的 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`）。
>
> ⚠️ 已知暴露项：`.github/workflows/deploy.yml` 里**硬编码了 Cloudflare 账号 ID**，而仓库是公开的。
> 账号 ID 不是密钥（无法据此登录或改配置），但可被用于社工，介意的话把它挪进 Secrets 并改成 `${{ secrets.CLOUDFLARE_ACCOUNT_ID }}`。

---

## 🏗️ 系统架构

```
用户浏览器
  │
  │  Vue 3 SPA  ← 托管在 Cloudflare Pages（yuanfangorganics.ccwu.cc）
  │   ├── Pinia 状态：player / playlist / user / search
  │   ├── APlayer + hls.js 播放 HLS 音频
  │   └── localStorage：歌词缓存、背景模式、播放历史、偏好
  │
  ├── fetch /list ─────────────► Cloudflare Worker（music-proxy）
  ├── 请求 *.m3u8 / *.ts ──────►   ├── /list        → 读 R2 的 playlist.json，补 id/album 后下发
  └── 歌词直连 lrclib.net ◄────┐   ├── /api/lyrics/* → 读 R2 的 lyrics/<key>.json
                               │   ├── /api/artists、/api/search、/api/playlists(front-end 用不到)
                               │   └── /*           → 代理 R2 里的 HLS 分片（兜底路由）
                               │            │
                               │            ▼
                               │   Cloudflare R2（music-bucket）
                               │     ├── <音乐夹>/<曲目名>/playlist.m3u8 + outputNNN.ts
                               │     ├── playlist.json      ← 曲目索引，由 list-r2.cjs 生成并回写
                               │     └── lyrics/<trackId>.json ← 云端歌词缓存
                               │
                               └── lrclib.net（免费歌词 API，CORS 全开，前端可直连）
```

### 一次播放的完整链路

1. 打开站点 → 加载 SPA → `GET /list`（约 67 KB，262 首）→ `normalizeTrack()` 解析出 title/artist/folder
2. 首页自动挑「曲目最多的艺人」填队列并起播第一首（浏览器自动播放策略可能拦下，1.2s 后校正按钮状态）
3. hls.js 拉 `playlist.m3u8` → 按需拉 `outputNNN.ts`（每片约 10 秒 / 189 KB）
4. 歌词：localStorage → 云端 `lyrics/<trackId>.json` → lrclib 在线匹配，命中后**同时回写**本地与云端

---

## 🛠️ 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端 | Vue 3（Composition API + `<script setup>`）+ TypeScript 5.3 | |
| 构建 | Vite 5 | 开发端口 3000 |
| 路由 | Vue Router 4 | 7 条路由（含 404） |
| 状态 | Pinia 2 | player / playlist / user / search |
| 播放 | APlayer 1.10 + hls.js 1.5 | APlayer 不原生支持 HLS，由 hls.js 接管 `<audio>` |
| 样式 | 原生 CSS + CSS 变量 | 玻璃拟态（Glassmorphism）+ 全屏壁纸，页面本身不滚动 |
| 后端 | Cloudflare Worker（TypeScript → esbuild 单文件） | 独立子项目 `worker/` |
| 存储 | Cloudflare R2 | 音乐分片 + 索引 + 歌词 |
| 托管 | Cloudflare Pages（前端）+ Workers（API） | |
| CI/CD | GitHub Actions | push main 即部署 |
| 测试 | Vitest | `src/stores/playlist.test.ts` |

---

## 📁 项目结构

```
yuanfang-music-player/
├── index.html / vite.config.ts / tsconfig*.json
├── package.json                # 前端脚本（含 deploy:local）
├── wrangler.toml               # Worker 配置：name / main / R2 绑定 / compatibility_date
├── .env                        # 全部凭证（gitignore，勿提交）
├── .env.example                # 凭证模板
├── deploy-code.bat             # Windows：代码部署（前端 + Worker）
├── deploy-music.bat            # Windows：曲库索引同步
├── list-r2.cjs                 # 扫描 R2 → 生成 playlist.json → 回写 R2
├── upload-lyrics.mjs           # 本机批量上传 .lrc 到 R2 的 lyrics/
├── playlist.json               # 曲目索引（备份用，前端不直接读）
│
├── src/                        # ★ 前端
│   ├── main.ts / App.vue / router/index.ts
│   ├── views/                  #   HomeView（主界面）/ Browse / Artist / Search / Playlist / Settings / NotFound
│   ├── components/             #   player/（MusicPlayer、LyricsPanel）、layout/、common/、artist/、search/、playlist/
│   ├── stores/                 #   player.ts / playlist.ts / user.ts / search.ts（+ playlist.test.ts）
│   ├── services/               #   api.ts / music.ts / lyrics.ts / prefetch.ts / playlist.ts
│   ├── composables/ utils/ types/
│   └── assets/styles/          #   variables.css（设计 token）、global.css
│
├── worker/                     # ★ Worker 独立子项目（有自己的 package.json）
│   └── src/
│       ├── index.ts            #   路由表分发
│       ├── routes/             #   list / proxy / lyrics / artists / playlists / cors
│       └── utils/              #   r2.ts / response.ts（generateTrackId、album 派生）
│
├── public/                     # bg/0-6.webp（壁纸）、PIC/disc-default.svg（默认唱片）、_routes.json
└── .github/workflows/deploy.yml
```

### 已经不再使用的文件（可删）

```
src/components/layout/AppSidebar.vue    # 侧边栏已从布局移除
src/components/playlist/PlaylistPanel.vue
src/components/player/LyricsPanel.vue
src/components/playlist/MyPlaylists.vue
worker.js                               # 旧版 JS Worker，已被 worker/src 取代
public/PIC/IMG_3092.JPG                 # 未提交的废弃素材
```

---

## 💾 数据存储

### 1. Cloudflare R2（`music-bucket`）— 唯一的服务端存储

```
music-bucket/
├── 01_AQUA(水叮当)/
│   └── Aqua - Barbie Girl/
│       ├── playlist.m3u8        # HLS 清单（一首歌一份）
│       ├── output000.ts         # 分片，约 10 秒 / 189 KB
│       └── output001.ts ...     # 一首歌约 20 片 ≈ 3.8 MB
├── 05_郑源/
│   └── ...
├── playlist.json                # 曲目索引（Worker /list 读它）
└── lyrics/<trackId>.json        # 云端歌词缓存（{ syncedLyrics, plainLyrics, ... }）
```

- **曲目数**：262 首。R2 里**没有** `.lrc` 文件，也**没有**封面图（实测 404）。
- **曲目名**取自目录名（`item.Key.split('/').slice(-2,-1)[0]`），因此**目录名必须写成 `歌手 - 歌名`**，否则艺人会解析成 `Unknown`。
- **音乐夹名** = 一级目录名（如 `01_AQUA(水叮当)`），前端按它分组，所以新夹要带序号前缀保持排序。
- **trackId** = 对原始曲目名做 FNV-1a 64 位哈希（16 位 hex）。前端 `src/utils/parser.ts` 与 Worker `worker/src/utils/response.ts` **必须保持一致**，否则歌词 key 对不上。

### 2. 浏览器 localStorage（前缀 `ym:`）

| key | 内容 |
|-----|------|
| `ym:lrc:<trackId>` | 歌词本地缓存（三级缓存的第一级） |
| 用户偏好 / 背景模式 / 播放历史 / 播放列表 | 见 `src/stores/user.ts`、`useLocalStorage.ts` |

### 3. 仓库内 `playlist.json`

只是索引备份，**前端不读它**（前端读 Worker `/list`）。改它不影响线上。

---

## 🚀 部署链路（重要）

### 正常路径：push 到 main → GitHub Actions 自动部署

`.github/workflows/deploy.yml` 两个 job **串行**执行（避免限流）：

```
deploy-frontend   npm ci → npm run build → wrangler pages deploy dist/
      ↓ needs
deploy-worker     worker npm ci → esbuild → wrangler deploy
```

### ⚠️ Cloudflare Pages 自带 Git 集成：已停用

Pages 项目 `yuanfang-music` 曾经**同时**挂着 GitHub 集成，于是每次 push 会跑两条链路：

```
12:24  github:push   Cloudflare 集成自己构建部署   ← build_config 为空 → 不构建，直接上传「仓库根」
12:25  ad_hoc        GitHub Actions 的 wrangler    ← 正确（dist）
```

两条都是 Production，**谁最后完成谁生效**。CF 那条发的是仓库根（源码），于是 push 后约 1 分钟线上是白屏源码页，等 CI 覆盖回来 —— 这就是「有时打开是坏的 / 好像没更新」的来源。

**2026-10-09 已修**：把 Pages 的自动部署总开关关掉（`deployments_enabled=false`），生产只由 CI 一条链路发。

- 副作用：PR 预览部署与 PR 评论一并停用（单人项目无影响）
- 恢复方式：CF Dashboard → Pages → `yuanfang-music` → Settings → Builds and deployments → 打开 Automatic deployments
- 注意：`wrangler pages deploy`（CI / 手动）**不受**这个开关影响，一直可用

### 手动部署

```bash
npm run build && npm run deploy:pages     # 前端
npm run deploy:worker                     # Worker（含 esbuild 构建）
npm run deploy:local                      # Windows：跑 deploy-code.bat
```

---

## 🔄 日常流程

### A. 改代码 → 上线

```bash
git add -A && git commit -m "..." && git push origin main
# CI 自动构建部署（约 1~2 分钟）。前端有 CDN 缓存，验证时请 Ctrl+F5 硬刷。
```

> 也可以直接双击 `deploy-code.bat`（本地构建 + 部署 + push），但它做的事 CI 都会做，平时没必要。

### B. 新增音乐（mp3 直传，不需要切片）

```bash
# 1. 一条命令上传（会递归整个目录）
npm run music:upload -- "D:\待上传" --folder "06_网络歌曲"   # 整个目录传进同一个音乐夹
npm run music:upload -- "D:\待上传"                        # 本地目录名即音乐夹，层级原样映射
npm run music:upload -- "D:\待上传" --dry-run               # 先预览不上传

# 2. 重建索引（扫 R2 生成 playlist.json 并回写）
npm run generate:playlist

# 3. 发布
git add playlist.json && git commit -m "chore: update playlist" && git push
```

上传脚本做的事：**ffprobe 读时长/码率 → `ffmpeg -c:a copy -vn` 剥掉内嵌封面 → 传 R2 → 时长写进 R2 的 `durations.json`**。
剥封面是无损的（音频流直接 copy），但会去掉内嵌的配图 —— 封面动辄几百 KB 且在文件头部，浏览器得先越过它才能出声。

**两条约定**（不合规脚本会警告，但不阻断）：
- 文件名必须是 `歌手 - 歌名.mp3`，否则列表里艺人显示 `Unknown`
- 码率 ≤ 192 kbps：国内到 CF 实测约 50 KB/s，320 kbps 会卡顿

老歌仍是 HLS 分片，与新 mp3 在同一条 `/list` 里共存，前端按 URL 后缀自适应。
（历史遗留：加 HLS 需本机 `ffmpeg -f hls` 切片后按 `<音乐夹>/<曲目名>/playlist.m3u8 + outputNNN.ts` 上传，脚本不再代办。）

> `generate:playlist` 生成的条目只有 `{name,url,type,duration}`，没有 `album`/`id`；
> Worker 在 `/list` 时会用 `raw.album || albumFromUrl(url)` 和 `generateTrackId(name)` 补齐，**所以不影响功能**。

### C. 补中文歌词

英文曲目由前端自动到 lrclib 匹配；中文曲目命中率低，用本机脚本人工补：

```bash
npm run lyrics:list                        # 列出「曲目名 → 歌词 ID」
npm run lyrics:upload -- ./lyrics          # 上传目录下所有 .lrc
npm run lyrics:upload -- ./lyrics --dry-run
```

- `.lrc` 文件名决定归属：与曲目目录名完全一致，或去掉 `[mqms2]` 之类后缀宽松匹配
- 编码 UTF-8 / GBK 都收
- 直写 R2 的 `lyrics/` 前缀，用 `.env` 里的 R2 S3 密钥 —— **没有公网写入接口，拿到密钥才写得进去**
- 新增歌曲后要先跑 `generate:playlist` 刷新索引，脚本按它匹配

---

## 📡 API 参考

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/list` | 全部曲目索引，返回 `{id,name,url,type,album}[]` |
| GET | `/api/lyrics/:key` | 读 R2 的 `lyrics/<key>.json` |
| GET | `/api/artists`、`/api/artists/:id` | 艺人列表 / 详情（前端目前本地分组，未使用） |
| GET | `/api/search?q=` | 搜索（前端本地搜索，未使用） |
| GET/POST/PUT/DELETE | `/api/playlists[/:id]` | 播放列表 CRUD（前端未接） |
| GET/HEAD | `/*` | 代理 R2 任意对象（`.m3u8` → `application/vnd.apple.mpegurl`，`.ts` → `video/MP2T`） |
| OPTIONS | `*` | CORS 预检 |

**Worker 在 `/list` 时做的加工**（`worker/src/utils/response.ts`）：补 `id`（FNV-1a 哈希）、补 `album`（取 URL 一级目录，去掉 `01_` 前缀）。

**前端拿到后必须再过 `normalizeTrack()`**（`src/services/music.ts`）：拆分 `歌手 - 歌名`、算 `folder`、算同一个 id。直接拿原始对象渲染会导致「歌能放，但列表和底栏一片空白」。

---

## ⚠️ 常见问题

**Q：push 了但线上没变化？**
先 Ctrl+F5 硬刷（Pages 有 CDN 缓存）。若仍不对，去 GitHub Actions 看这次 run 是否成功；再对比线上 `assets/index-*.js` 的文件名与本地 `dist/index.html` 是否一致。历史上最大的坑是 CF 自带 Git 集成用仓库根覆盖了 CI 的产物（已停用，见上文）。

**Q：列表空白，但能播放、底栏没歌名？**
`/list` 的原始对象没有 `title`/`artist`，必须经过 `normalizeTrack()`。2026-10-09 还修过一个模板 bug：列表头的 `v-if` 与列表的 `v-else-if` 串成了同一条链，导致有队列时只渲染表头、曲目行全被跳过。

**Q：播放慢、卡顿、点开要等 1~2 分钟？**
根因是**国内到 Cloudflare 的链路本身不稳**（实测直连 36~72 KB/s，且随机 TLS 中断；走代理更慢）。已做的缓解：hls.js 调参（`startFragPrefetch`、`maxBufferLength=20`、失败重试 6 次）、点击播放后后台并行预取分片。**治本方案未实施**：把音频迁到国内可达的对象存储（阿里云 OSS / 腾讯 COS），需重传约 1 GB 并改 Worker 与前端地址。

**Q：为什么 `workers.dev` 打不开？**
该域名在大陆被墙。前端统一走自定义域名 `api.yuanfangorganics.ccwu.cc`；`music-proxy.osmanfeng.workers.dev` 只是备用。

**Q：艺人显示成 `Unknown`？**
R2 目录名不符合 `歌手 - 歌名` 格式（例：`Aqua - Barbie Girl`）。解析规则见 `src/utils/parser.ts`，支持 `Artist - Title`、`Artist- Title`、纯文本三种。

**Q：`npm run generate:playlist` 报 `require is not defined`？**
`package.json` 是 `"type": "module"`，脚本必须用 `.cjs` 后缀（现为 `list-r2.cjs`）。

---

## 🌐 本机网络要求（推送 / 部署前必读）

**部署与推送都依赖能连通 Cloudflare 与 GitHub 的网络**，本机实测：

| 操作 | 需要 | 说明 |
|------|------|------|
| `git push` 到 GitHub | 直连（WARP 通常够） | GitHub 在国内常被干扰，开 WARP 后一般可行 |
| `wrangler` 任何命令（部署、查部署历史、调 CF API） | **WARP 开着** | CF API 直连经常 `fetch failed` |
| 浏览器访问线上站点 | 无特殊要求 | 前端与 API 都走了自定义域名，国内可直连 |

**两个反复踩到的坑：**

1. **Clash Verge 会设 Windows 系统代理并把本地请求劫持掉**（表现为 `unexpected EOF` / `SSL connection could not be established`，极易误判成服务端挂了）。
   测网络前先确认：
   ```powershell
   Get-Process | Where-Object { $_.ProcessName -match "clash|verge|mihomo" }
   Get-ItemProperty "HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings" | Select ProxyEnable
   ```
   要么彻底退出 clash 进程，要么在命令前置 `$env:HTTP_PROXY=''; $env:HTTPS_PROXY=''; $env:ALL_PROXY=''; $env:NO_PROXY='*'`。

2. **Clash 退出后 git 仍可能走残留的 `127.0.0.1` 代理**，push 直接失败：
   ```
   fatal: unable to access '...': Failed to connect to github.com port 443 via 127.0.0.1
   ```
   解法（一次性、不改全局配置）：
   ```bash
   git -c http.proxy= -c https.proxy= push origin main
   ```

WARP 开关脚本：`G:\Program Files\.claude\tools\warp-on.ps1`（由本机工具链维护，不在本仓库内）。

---

## 🧰 npm 脚本

| 命令 | 说明 |
|------|------|
| `npm run dev` | Vite 开发服务器（3000） |
| `npm run build` | `vue-tsc --noEmit` + Vite 构建 → `dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm run test` | Vitest 单元测试 |
| `npm run music:upload` | 上传 mp3 原文件到 R2（`--folder "夹名"` 指定音乐夹 / `--dry-run` 预览） |
| `npm run generate:playlist` | 扫描 R2（m3u8 + mp3）→ 生成并回写 `playlist.json` |
| `npm run lyrics:list` / `lyrics:upload` | 歌词上传工具（本机） |
| `npm run worker:build` / `worker:dev` | Worker 构建 / 本地调试 |
| `npm run deploy:pages` | 部署前端到 Pages（`wrangler pages deploy dist`） |
| `npm run deploy:worker` | 构建并部署 Worker |
| `npm run deploy:local` | 跑 `deploy-code.bat`（Windows 一键） |
| `npm run lint` / `format` | ESLint / Prettier |

---

## 📋 待办与遗留

- [ ] **卡顿治本**：音频迁到国内对象存储（唯一有效路径，见常见问题）
- [ ] 中文歌歌词命中率观察，必要时补充
- [ ] 清理未使用文件：`AppSidebar.vue`、`PlaylistPanel.vue`、`LyricsPanel.vue`、`MyPlaylists.vue`、`worker.js`、`public/PIC/IMG_3092.JPG`
- [ ] Worker 端 `/api/artists`、`/api/search`、`/api/playlists` 前端未接，可删或接上
- [ ] 把 workflow 里硬编码的 Cloudflare 账号 ID 挪进 Secrets

---

## 📝 更新记录

### 2026-10-09

| 类别 | 改动 |
|------|------|
| 🐛 修复 | **列表空**：`HomeView.vue` 列表头 `v-if` 与列表 `v-else-if` 串成一条链，有队列时曲目行被整体跳过（只剩表头） |
| 🐛 修复 | 曲库未解析导致列表与底栏歌名全空（回归）——`/list` 原始对象必须过 `normalizeTrack()` |
| 🐛 修复 | 首页曲库静默空白 + 重复抓取曲库导致加载慢 |
| 🐛 修复 | `npm run deploy:pages` 曾指向项目根目录而非 `dist` |
| ✨ 新增 | 歌词云端优先（localStorage → R2 → lrclib，命中即双写） |
| ✨ 新增 | 首页默认填队列并起播第一首；极简通栏布局、三列歌单、播放模式、哈希 ID、歌词后台上传 |
| 🔧 运维 | **停用 Cloudflare Pages 自带的 Git 集成自动部署**，消除「push 后短暂被仓库根覆盖」的坏版本窗口 |

### 2026-10-04

悬浮玻璃风格改版（对齐 music.mmp.cc）：全屏壁纸 + 玻璃面板 + 页面不滚动；在线歌词（lrclib）+ 音乐夹二级列表；CD 唱片改用 `disc-default.svg`。

---

## 📄 许可

仅供个人学习研究使用。音乐文件版权归各自版权持有人所有。
