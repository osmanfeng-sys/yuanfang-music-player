# yuanfang-music-player 架构与规划

> 最后更新：2026-10-12 ｜ Vue 3 + TS 在线音乐播放器 · Cloudflare Pages + Worker + R2
> 主页单视图细节见 `homepage-plan.md`，运维踩坑见 `memory.md`。**与代码冲突时以代码为准。**

## 一、现状速览

| 项 | 值 |
|---|---|
| 前端 | Vue 3.4 + TypeScript 5.3 + Vite 5 + Pinia 2 + vue-router 4 |
| 播放内核 | APlayer 1.10（npm 包）+ hls.js 1.5（当前库全是 mp3，HLS 路径保留但空跑） |
| 托管 / API | Cloudflare Pages（`yuanfang-music`）· Worker（`music-proxy`，独立 TS 子项目） |
| 存储 | Cloudflare R2 `music-bucket`（绑定名 `MUSIC`） |
| 音频 | **393 首 mp3**（直传 + HTTP Range，非 HLS） |
| 歌词 | `lyrics/<trackId>.json`（271 个）+ 索引 `playlist.json` / `durations.json` |
| 规模 | `src/` **50 个文件 / 7299 行**；`worker/src/` 10 个文件 / 709 行 |
| CI/CD | GitHub Actions，push 到 main 即部署；仓库公开 `osmanfeng-sys/yuanfang-music-player` |

```
前端    https://yuanfangorganics.ccwu.cc         Pages 自定义域
API     https://api.yuanfangorganics.ccwu.cc     Worker 自定义域
回退    https://music-proxy.osmanfeng.workers.dev
```

> ⚠️ `*.ccwu.cc` 这条 SNI 在国内被点名阻断。**开着 Clash 想访问自己的站点，靠 Clash 里那份
> WARP 出站配置**（见 `memory.md` 与全局 `network-notes.md`）；开机后要跑一次
> `G:\Program Files\.claude\tools\warp-proxy-on.ps1`。

## 二、架构

### 2.1 前端分层

```
views/      页面（各自对应一条路由）
  ↓
components/ layout 骨架 · player · playlist · search · artist · common
  ↓
stores/     player(播放状态) · playlist(曲库 + 用户歌单) · user(偏好) · search
  ↓
services/   api(fetch 封装) · music(曲库) · playlist(歌单 CRUD) · lyrics(三级缓存) · prefetch
  ↓
utils/      constants · format · parser(文件名→歌手/歌名) · localStore(localStorage) · userKey
types/      music · playlist · api（+ index.ts barrel，`@/types` 全项目在用）
```

最大的文件：`HomeView.vue` 1002 · `AppFooter.vue` 537 · `AppHeader.vue` 413 ·
`SettingsView.vue` 375 · `stores/playlist.ts` 372。

### 2.2 布局骨架

```
.layout (fixed; inset:0; overflow:hidden)    ← 页面本身不滚动，滚动交给面板内部
├─ 背景三层  .layout__bg(壁纸) / --bg-cover(封面模糊) / .layout__scrim
├─ AppHeader        56px 顶栏
├─ .layout__content 绝对定位在顶栏与底栏之间 → <router-view>
└─ AppFooter        底部播放条（--playerbar-height: 88px，≤767px 120px）
```

### 2.3 路由

```
/                主页（左右两栏：列表 + 播放面板）
/browse          浏览：艺人 + 整个音乐库（393 首，可搜可点播）
/artist/:id      艺人详情
/search          搜索（无入口链接，功能已被主页搜索 tab 覆盖）
/playlists       我的歌单（列表 + 新建 + 改名 + 删除）
/playlist/:id    歌单详情（播放全部 + 移除 + 从曲库添加）
/settings        设置（播放 / 歌单同步 / 数据 / 关于）
404
```

### 2.4 Worker 端点

| 端点 | 说明 |
|---|---|
| `GET /list` | 曲库索引（读 R2 `playlist.json`，由 `response.ts` 补 `id`/`album`/`type`） |
| `GET /proxy/*` | 音频流，**无鉴权**，支持 Range（206/416/`Accept-Ranges`） |
| `GET /api/artists` · `/api/artists/:id` | 艺人列表与详情（Worker 侧从曲库派生） |
| `/api/playlists*` | 用户歌单 CRUD，**要 `X-User-Key`，否则 401** |
| `GET /api/lyrics/:key` | 读 `lyrics/<key>.json`，只读 |
| `GET /api/search` | 曲库搜索 |

### 2.5 数据流要点

- **曲库**：`/list` → `playlistStore`（`folders` 按音乐夹分组、`getTrackById`、`searchTracks`）
- **时长**：`/list` 不下发，挂载后 6s 由 `fillDurations()` 后台补（延迟是故意的，避开首屏抢带宽）
- **歌词**：云端 R2 → `localStorage('ym:lrc:<id>')` → lrclib.net；只读，写入靠 `upload-lyrics.mjs`
- **偏好**：`userStore` 存 localStorage（`playHistory` / `favorites` / `bgMode` / `lastSession`）

## 三、用户歌单与账号

**没有账号体系**，用「自定义 ID + 密码」派生一个 key 当身份：

```
用户输入     ID + 密码（自定，非注册；不存在即新建，歌单为空）
前端派生     key = base64url(sha256("<ID>:<密码>")).slice(0, 22)     utils/userKey.ts
请求         X-User-Key: <key>                                       services/api.ts 统一注入
存储         R2  user-playlists/<key>/index.json                     worker/src/routes/playlists.ts
```

- **22 位 base64url 是刻意的**：字符集只有 `A-Za-z0-9_-`，天然路径安全，
  服务端只需一道格式正则，无需 `../` 穿越过滤
- **密码不过网**：前端算完只发 key，Worker 侧零密码逻辑（无 salt / 无 401 流程 / 不落库）
- **双模式**：有凭据走云端；没有则存 `localStorage('ym:userPlaylists')`，功能照常可用。
  **不做双向同步、不做冲突合并** —— 有凭据就以云端为准
- **入口**：顶栏人像按钮弹浮层（未登录=创建/登录，已登录=显示 ID + 指纹 + 退出）；
  设置页有同样的表单
- **加歌**：歌单详情页「＋ 从曲库添加」（搜索 → 点结果即加入，已在的显示对勾禁用）
- 歌单只存 `trackIds` **引用**，不存音乐。`/proxy/*` 无鉴权，**任何访客都能播放全部 393 首** ——
  用户隔离的是「我的歌单列表」，不是「我能听哪些歌」。内容隔离成本高一个量级，不做

> ⚠️ 威胁模型是**防误入 / 防随手翻**，不是防定向攻击：`GET /api/playlists` 用候选 key 试，
> 返回空数组还是非空就是一个 oracle，且没有限流。UI 已强制密码 ≥8 位。

## 四、关键设计决策（只留反直觉的）

| 决策 | 为什么 |
|---|---|
| **APlayer 必须省略 `type: 'mp3'`** | 给了 `type:'mp3'` 它会**静默不设 src**；省略时按 URL 自己判断。只有 HLS 才显式给 `type:'hls'` |
| **上传时剥掉 mp3 内嵌封面** | 封面（APIC）几百 KB 且在文件头部，浏览器要先越过它才能出声，直接毁掉「mp3 出声快」的收益 |
| **码率 ≤192 kbps** | 国内到 CF 实测约 50 KB/s，320 kbps 会卡 |
| **mp3 直传 + Range 取代 HLS 切片** | HLS 要下 m3u8 + 大量分片，弱链路上起播 1~2 分钟；mp3 一步到位 |
| **全屏壁纸 + 玻璃面板 + 页面不滚动** | 对齐参考站 `music.mmp.cc`，滚动只发生在面板内部 |
| **主色红粉 `#ff5e5e`** | 同上 |
| **歌词三级缓存** | 云端是人工核对过的、可信度最高，必须放最前才能让重新上传立即可见 |
| **`public/_routes.json` 必须不存在** | 项目没有 `functions/`（API 是独立 Worker），但 Pages 见到它就认为有 Functions 要发布 → 部署报 `Failed to publish your Function`。删掉才通 |
| **CF 自带 Git 集成已停用** | 它不构建、把仓库根当产物发布，push 后约 1 分钟线上是源码版（白屏）。靠 `deployments_enabled=false` 收敛成只有 CI 一条链路 |

## 五、日常流程

```bash
npm run dev                # Vite，端口 3000，/api 代理到线上 Worker
npm run build              # vue-tsc --noEmit && vite build
npm test                   # vitest run
npm run deploy:pages       # wrangler pages deploy dist（需代理）
npm run worker:build       # cd worker && npm run build（esbuild）
npm run deploy:worker      # 构建 + wrangler deploy
```

**曲库 / 歌词四步（顺序不可换）**

```bash
npm run music:upload -- ./music    # 1 传 mp3（递归）
npm run generate:playlist          # 2 扫 R2 重建 playlist.json（并同步 R2）
npm run lyrics:upload -- ./music   # 3 传歌词（按 playlist.json 反查 trackId）
deploy-music.bat                   # 4 提交推送
```

> `lyrics:upload` 靠 `playlist.json` 的曲目名反查 trackId，**第 2 步没跑，新歌歌词全匹配不上**。

## 六、未实施 / 已知缺口

```
测试          只有 2 个 store 测试文件（7 条），覆盖率接近于零
PWA           没有 manifest / service worker，不支持加主屏与离线
歌单加固       云端 key 无服务端限流；同一用户多标签页并发写仍会后写覆盖先写
封面          R2 无封面文件 → 唱片恒显 disc-default.jpg，且「封面模糊」背景模式永远走不到
卡顿          **未解决**：国内到 CF 链路不稳，点播 1~2 分钟才出声。
              已在 hls.js 参数与并行预取上缓解；治本要迁国内对象存储（约 1GB 重传）
```

## 七、安卓 APK —— Capacitor WebView 容器（计划中）

思路：用 Capacitor 把**线上网页**包成一个安卓 App，代码零改动、样式与线上完全一致。

### 7.1 选型：壳子模式（加载线上地址）

| | 模式 A 本地包 `webDir: "dist"` | 模式 B 壳子 `server.url: <线上地址>` |
|---|---|---|
| 更新 | 每次改代码都要重编 APK + 用户重装 | **线上更新即 App 更新，不用发版** |
| 离线 | 首屏可用（音频仍要联网） | 完全依赖网络 |
| 结论 | | **选 B** |

**但加载哪个地址在本项目有讲究**：

```
✗ https://yuanfangorganics.ccwu.cc    这条 SNI 在国内被点名阻断（实测 0.2s connection reset）
✓ https://yuanfang-music.pages.dev    实测国内直连 200 / 1.1s，未被阻断
```

所以 `server.url` 填 **pages.dev**，不是 ccwu.cc（后者只在挂代理/WARP 时才通）。

### 7.2 ⚠️ 先验证前置条件，再写任何代码

```
页面源  yuanfang-music.pages.dev       手机浏览器直接开，能出首屏吗
音频源  api.yuanfangorganics.ccwu.cc   ← 真正的卡点，见下
```

音频、`/list`、歌词全部走 `WORKER_BASE_URL`：

```
api.yuanfangorganics.ccwu.cc       被 SNI 点名阻断
music-proxy.osmanfeng.workers.dev  回退域，但 workers.dev 在大陆同样被墙
```

**两个域名在国内都不通。** 也就是说：**壳子 App 能不能出歌，取决于你手机当前的网络环境**
（挂着代理才通）。若不打算让 App 依赖代理，得先解决音频域名可达性
（换国内可直连的域名，或按第六节把音频迁国内对象存储）—— 否则做出来的 APK 是
「页面出得来、一首歌都放不了」。

> **7.2 验证不过，7.3 之后都不用做。**

### 7.3 手机端四个坑（按本项目实际改写）

**① 后台播放被挂起 —— 风险最高，且没有开箱方案。**
本项目播放内核是 APlayer，音频是 WebView 里 `<audio>` 拉 `/proxy/*` 的 mp3，切后台/锁屏会被系统挂起。
Capacitor **没有官方的前台服务后台播放方案**：`cordova-plugin-background-mode` 是三代前的老插件，
兼容性一般；自写前台服务要写原生；搬到原生音频插件则**等于重做播放器**（APlayer 那套列表/歌词/倍速全废）。
→ **先做最小 PoC，只验证"锁屏后还能不能继续放"，再决定投入。**

**② 锁屏控制 / 媒体中心 —— 建议先做这个，它不依赖 Capacitor。**
前端目前**完全没有** `navigator.mediaSession`（全仓 grep 为空）。这是纯 Web API，
在 `MusicPlayer.vue` 的 `listswitch` / `play` / `pause` 里更新元数据并注册
`previoustrack / nexttrack / play / pause` 处理器即可。**浏览器和 App 同时受益，零原生代码**，
是整条路线里投入产出比最高的一步。

**③ 跨域 / HTTPS。** 全站标准 SSL，无自签问题；`network_security_config.xml` 本项目用不上。
但注意：壳子模式下**页面源（pages.dev）与音频源（ccwu.cc）是跨域的** ——
`/proxy/*` 已带 `Access-Control-Allow-Origin: *` ✓；而歌单的 `X-User-Key` 发往 API 域，
**在 WebView 里同样走标准 CORS，不会因为"是 App"而豁免**。

**④ 离线缓存 —— 本项目没有 HLS。**
Gemini 建议里说的"HLS 分片缓存"不适用：393 首已全部是 mp3 直传（`playlist.json` 里
m3u8 条数为 **0**），所以离线是「整文件落盘」，用 Capacitor Filesystem 按 `trackId` 存、
播之前查本地有没有即可，比分片简单得多。**属第二阶段，第一步先保证在线流畅。**

### 7.4 落地步骤

**前置：本机没有 Android 工具链**（`java` / `javac` / `gradle` / `adb` 全部未安装，
`ANDROID_HOME` 未设置）。要先装 **JDK 17+** 和 **Android Studio（含 SDK）**，几个 GB —— 这步本身是独立任务。

```bash
npm i @capacitor/core @capacitor/cli @capacitor/android
npx cap init "远方音乐" ccwu.yuanfang.music --web-dir=dist
npx cap add android
```

`capacitor.config.ts`（模式 B）：

```ts
export default {
  appId: 'ccwu.yuanfang.music',
  appName: '远方音乐',
  webDir: 'dist',                              // 留着做首屏兜底页
  server: { url: 'https://yuanfang-music.pages.dev', cleartext: false }
}
```

```bash
npx cap sync android
cd android && ./gradlew assembleDebug        # 产物 app/build/outputs/apk/debug/
```

正式发布用 `assembleRelease` + 自建 keystore 签名。

### 7.5 后续优化

**安全区适配（做壳必做）**：现在用的是 `--page-gutter: 20px` / `--topbar-height: 56px`
这类固定值，刘海屏 / 挖孔屏 / 手势条会遮挡顶栏和底栏。在 `variables.css` 加

```css
--safe-top: env(safe-area-inset-top, 0px);
--safe-bottom: env(safe-area-inset-bottom, 0px);
```

让 `AppHeader` 的 padding、`.layout__content` 的位置、`AppFooter` 的 `bottom` 叠加这两个值；
`index.html` 的 viewport meta 要补 `viewport-fit=cover` 才取得到值。
**浏览器里 `env()` 取不到就是 0，不影响网页，所以可以无条件先加上。**

其余（沉浸式状态栏、启动图、应用图标）属于打包期收尾，在 Android Studio 里配。

---

## 附录：关键参数速查

| 参数 | 值 | 位置 |
|---|---|---|
| Worker URL / 回退 | `https://api.yuanfangorganics.ccwu.cc` / `music-proxy.osmanfeng.workers.dev` | `utils/constants.ts` |
| R2 bucket / Worker 名 | `music-bucket` / `music-proxy` | `wrangler.toml` |
| Pages 项目 / 自定义域 | `yuanfang-music` / `yuanfangorganics.ccwu.cc` | CF |
| Dev 端口 / 代理 | `3000`，`/api` → 线上 Worker | `vite.config.ts` |
| 构建分包 | `vendor`(vue/router/pinia) + `player`(aplayer/hls.js) | `vite.config.ts` |
| 主题色 / 顶栏署名 | `#ff5e5e` / `@AI涛哥`（微软雅黑 `#c084fc`） | `variables.css` / `AppHeader.vue` |
| 布局尺寸 | topbar 56px · playerbar 88px（≤767px 120px）· gutter 20px | `variables.css` |
| 音频格式 / 码率上限 | mp3 直传 + Range / 192 kbps | R2 + `routes/proxy.ts` |
| 歌词文件 / trackId | `lyrics/<trackId>.json` / hash 原始文件名（含 `[mqms]` 后缀） | R2 + `utils/response.ts` |
| localStorage 前缀 | `ym:`（`history` / `favorites` / `bgMode` / `userPlaylists` / `userId` / `userPass`） | `utils/constants.ts` |
| 播放历史上限 / 搜索防抖 | 100 首 / 300 ms | `utils/constants.ts` |
| 账号 key | `base64url(sha256("<ID>:<密码>"))` 前 22 位，随 `X-User-Key` | `utils/userKey.ts` |
| 歌单存储 | `user-playlists/<key>/index.json` | `worker/src/routes/playlists.ts` |
