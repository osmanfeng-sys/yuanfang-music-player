# 主页（HomeView）设计与改造说明 —— 远方音乐播放器

> **最后更新：2026-10-12**（按当前代码重写）
>
> 本文原名「主页改造计划」，记的是 2026-10 初一份 **Listen1 风格**改版方案：
> 单列 5 区域（Hero / 精选艺人网格 / 绿色均衡器可视化 / 精选曲目 / 最近播放）。
> **那份方案最终没有实施**，落地的是另一套设计 —— 参考站换成了 music.mmp.cc 的
> 「全屏壁纸 + 玻璃悬浮面板」风格，主页做成**左右两栏**而不是单列长页。
>
> 旧方案的痕迹在代码里**零残留**（`hero` / `equalizer` / `均衡器` / `可视化` /
> `精选艺人` / `featuredTracks` 全部搜不到），所以本文整体重写为**现状说明 + 真实待办**，
> 不再是一份「待执行的改造计划」。

---

## 〇、本文与 `project-plan.md` 的关系

两份文档**层级不同，不互相替代**：

|              | `project-plan.md` | 本文 `homepage-plan.md` |
|--------------|-------------------|--------------------------|
| 日期         | 2026-07-21（未再更新） | 2026-10-12（持续更新） |
| 范围         | **全项目**：单文件 Vanilla JS → Vue3 + TS 的整体重构蓝图 | **单个视图** `HomeView.vue`（1002 行） |
| 结构         | Phase 1–23（脚手架 / 类型 / 路由 / store / 组件 / Worker / 部署，外加歌词、歌单云同步、移动端、域名迁移、bug 记录） | 设计基线 + 布局 + 数据流 + 歌词链路 + 断点 + 真实待办 |
| 性质         | **历史蓝图**。Phase 1–18 的产物就是今天的代码，主体已执行完毕 | **现状说明**，按当前代码写，不是待执行的计划 |
| 该拿它干什么 | 查「当初为什么这么设计」、查**尚未实施**的专题方向 | 主页相关的**唯一**有效说明 |

### project-plan.md 里已被现实推翻的条目

留着对照，避免有人照着旧蓝图去代码里找不存在的东西：

| project-plan.md 写的 | 现状 |
|---|---|
| `HomeView` = 「首页：推荐/最近播放」（L89 / L340 / L1276） | 实际是左右两栏的「正在播放 / 播放列表 / 歌曲搜索」，**无推荐、无最近播放** |
| 「`worker.js` 保留直到 `worker/index.ts` 验证通过」（Phase 17） | 验证早已通过；`worker.js` 于 2026-10-12 作为遗留文件删除 |
| Phase 21.1「侧边栏 `<768px` 仍占位 280px，移动端改底部 TabBar」 | 侧边栏被要求**整个移除**（`AppSidebar.vue` 2026-10-12 删文件）；底部 TabBar 未做 |
| Phase 21.2 断点策略 `640 / 768 / 1024`，Mobile First | 实际是 **max-width 降级**：`900 / 767 / 639 / 479`（见第六节） |
| Phase 21.5 PWA 支持（加到主屏、离线播放） | **未做** —— `public/` 里没有 manifest、没有 service worker |
| Phase 19.2 歌词解析器在 `src/utils/lyrics.ts` | 实际在 `src/services/lyrics.ts` |
| Phase 10.1 `useAudioPlayer.ts` / 10.3 `useLocalStorage.ts` | 2026-10-12 作为零引用死代码删除 |
| Phase 5.2 `PlayerControls.vue`（标注「可选」） | 从未创建；播放控制实际在 `AppFooter.vue` |

### 三份文档的分工

```
project-plan.md    全项目历史蓝图 —— 架构由来 + 未实施的专题方向
homepage-plan.md   主页现状与待办（本文）
memory.md          运维记忆 —— 踩坑、部署流程、网络依赖、历史 bug（项目根，已 gitignore）
```

**代码本身才是最终真相**，三份文档都不例外；文档与代码冲突时以代码为准，并回头修文档。

---

## 一、设计基线

| 项 | 值 |
|---|---|
| 参考站 | `music.mmp.cc`（不是原计划的 Listen1） |
| 视觉体系 | 全屏壁纸 + 一切内容都是半透明玻璃面板悬浮其上 + **页面本身不滚动** |
| 主页形态 | 左右两栏（原计划是单列长页） |
| 主色 | `--color-primary: #ff5e5e`（红粉，**不是**原计划的绿 `#1DB954`） |
| 主页文件 | `src/views/HomeView.vue` — **1002 行**（含 template + style），是全项目最大的单文件 |
| 设计 token | `src/assets/styles/variables.css`（玻璃/间距/圆角/悬浮布局尺寸都在这） |

**为什么放弃原方案**：原计划的单列长页 + 音乐可视化，与「页面不滚动、面板内滚动」
这套布局前提冲突 —— 长页天然要滚，而参考站的骨架是满屏悬浮面板。改版时整页重写了。

---

## 二、当前布局

```
.layout (position: fixed; inset: 0; overflow: hidden)      ← AppLayout.vue 109 行
├─ .layout__bg / .layout__bg-cover / .layout__scrim         ← 三层背景
├─ AppHeader (56px)                                         ← 167 行
├─ .layout__content  (绝对定位在顶栏与底栏之间)
│   └─ HomeView → .home (display: flex; gap: --spacing-md)
│      ├─ .home__main    flex:1  玻璃面板                     ← 左：列表主区
│      │  ├─ .home__bar   48px  三个页签 + 4 个按钮 + 倍速
│      │  └─ .home__body  flex:1 内部滚动
│      ├─ .home__player  width:340px  玻璃面板                ← 右：歌名 / CD / 歌词
│      └─ .home__modal   说明弹层（fixed 覆盖）
└─ AppFooter (--playerbar-height: 88px / ≤767px 120px)       ← 537 行，底部播放控制条
```

---

## 三、区域详解

### 3.1 顶栏 `AppHeader.vue`

```
[Logo + 远方音乐]   正在播放(/)  浏览音乐(/browse)   [spacer]   🌓主题    ⚙设置(/settings)
```

只提供 3 个入口：`/`、`/browse`、`/settings`。
⚠️ **`/search` 和 `/playlist/:id` 两条路由没有任何入口链接**（见第七节）。

### 3.2 左主区 `.home__main`

**顶部按钮条 `.home__bar`（48px）**

```
[正在播放] [播放列表] [歌曲搜索]   ──spacer──   🎤播客  ⓘ说明  ⚙背景  [词]  [1x]
```

| 控件 | 行为 |
|---|---|
| 三个页签 | `activeTab: 'playing' \| 'playlist' \| 'search'`，切换列表内容 |
| 🎤播客 | 新窗口打开 `https://yuanfangselect.ccwu.cc/` |
| ⓘ说明 | `.home__modal` 弹层，逐条说明各功能 |
| ⚙背景 | 浮层：默认壁纸 / 封面模糊 / 纯黑（写 `userStore.bgMode`） |
| **词** | **仅 ≤900px 显示**，开关右侧歌词浮层（桌面端右栏常驻，无需开关） |
| 倍速 | 自绘按钮 + 窄浮层（0.5~2.0x），宽度共用一个 `--rate-w` 变量 |

**列表内容（按 tab）**

```
playing   播放队列 playerStore.queue —— # / 歌名 / 歌手 / 专辑 / 时长，当前行 ♪ + 红粉渐变高亮
playlist  一级：音乐夹（folders，点击进入）→ 二级：该夹曲目（顶部有「‹ 返回音乐夹列表」面包屑）
search    输入框（歌名/歌手实时过滤）+ 结果数 + 结果列表
```

列宽固定：`#` 34 · 歌手 200 · 专辑 240 · 时长 52（右对齐，等宽数字），行高 40px。
列头 `.home__head` 复用行内类名，保证三列严格对齐。

> ⚠️ 列头与列表**不能串成 v-if / v-else-if 链** —— 队列非空时列头必显示，
> 会把整个列表分支跳过，表现为「只有表头没有歌」。历史上踩过一次（见项目记忆第 8 节）。

### 3.3 右播放面板 `.home__player`（340px）

```
歌名（居中，超出省略）
CD 唱片 150px（播放时旋转，暂停停在当前角度）
歌手名
── 歌词区（flex:1，自动滚动到当前行居中）──
```

- 唱片用 `public/PIC/disc-default.jpg`（320×320，29.6 KB）—— **没有真实封面**，见第七节
- 旋转动画常挂，用 `animation-play-state` 切换（暂停时停在当前角度而非跳回 0）
- ≤900px 时整个面板变成 `position: fixed` 浮层，几何照抄 `.layout__content`，
  由顶栏「词」按钮开关

### 3.4 弹层

| 类名 | 用途 |
|---|---|
| `.home__modal` | 播放器说明（`showInfo`） |
| `.home__bg-panel` | 背景模式三选一（`showBgPanel`） |
| `.home__rate-panel` | 倍速列表（`showRatePanel`）—— 与背景浮层互斥 |

---

## 四、数据流

```
playlistStore (stores/playlist.ts 269 行)          playerStore (stores/player.ts 253 行)
  allTracks / folders / loading / error              queue / currentIndex / currentTrack
  fetchPlaylists()  searchTracks()                   isPlaying / currentTime / duration
  getTrackById()    fillDurations()                  lyricLines / lyricIndex / playbackRate
                                                     setQueue() / seek() / setPlaybackRate()
userStore (stores/user.ts 145 行)
  theme / bgMode / playHistory / favorites / lastSession
  addToHistory() / setBgMode() / ...

HomeView
  onMounted  loadMusic() → seedQueue() → 6s 后 fillDurations()
             若仍无 currentTrack，把 tab 落到「播放列表」（别让首屏一片空白）
  playFrom() addToHistory(id) → setQueue(list, idx) → isPlaying=true
             → 5s 后 prefetchHlsSegments(url)（等首片播出来再预取，别抢带宽）
  歌词       watch currentTrack.id → loadLyrics(track)，带切歌竞态保护
  滚动       watch lyricIndex → nextTick → box.scrollTo(el.offsetTop - clientHeight/2 + el.clientHeight/2)
```

**`seedQueue()`**：首屏没有队列时，用曲目最多的艺人的歌单填充并尝试播放。
浏览器自动播放策略会拦截无手势的 `play()`，所以 1.2s 后若音频仍是暂停，把 `isPlaying` 改回 false
—— 免得按钮显示「暂停中」而实际没在放，让人以为卡住。

---

## 五、歌词链路（`services/lyrics.ts` 126 行）

```
云端 Worker/R2（人工上传，可信度最高，放最前）
  → localStorage 缓存 ym:lrc:<trackId>（离线/加速兜底）
  → lrclib.net 在线匹配（GET /api/get?artist_name=&track_name=，CORS 全开，前端直连）
```

- 云端命中后回写本地缓存；`cloudMiss` 是**会话级**内存记录，避免反复问空
  （代价：本次会话内新上传的歌词要刷新页面才生效）
- `parseLrc` 支持 `[mm:ss.xx]`；纯文本歌词退化成 `time: i*3` 的**假时间轴**
  （这类歌高亮会整体漂移，属于已知缺口）
- 只读，无写入接口 —— R2 上的歌词由 `upload-lyrics.mjs` 本机直写

---

## 六、响应式断点

```
≤900px   右侧面板 → 全屏歌词浮层（顶栏「词」按钮开关）；隐藏专辑列；歌手列 140px
≤767px   底栏 AppFooter 折成三行（曲目+音量 / 进度 / 控制居中）
         --playerbar-height: 88px → 120px（写在 variables.css 的 :root）
≤639px   隐藏歌手列；顶栏收紧（--rate-w 48 / gap 3 / icon 24px / 页签小字）
≤479px   隐藏音量滑块，只留静音按钮
```

> ⚠️ `--playerbar-height` 被四处共用：`.layout__content`、`AppSidebar`、
> HomeView 歌词浮层（都是 `bottom: calc(var(--playerbar-height) + 12px)`）、AppFooter 的 `height`。
> **只改 AppFooter 的 height 会让内容区被底栏盖住** —— 必须改 `:root` 上的变量。

---

## 七、真实待办（按当前代码核过，不是原计划的条目）

### 7.1 封面缺失 —— 影响两个功能，都比看上去更严重

R2 里**没有封面文件**（实测 404），上传脚本还会剥掉 mp3 内嵌封面（为保证出声速度）。
后果有两个，第二个容易被忽略：

```
① 唱片恒显 disc-default.jpg —— 已知，接受
② AppLayout 的「封面模糊」背景模式【永远走不到】：
   coverUrl = playerStore.currentTrack?.cover || ''   → 恒为空串
   showCover    = bgMode === 'cover' && !!coverUrl    → 恒 false
   showWallpaper = bgMode === 'wallpaper' || !coverUrl → 恒 true
   即：用户选了「封面模糊」，实际渲染的仍是默认壁纸，且没有任何反馈
```

**修法二选一**：给曲目补封面数据（上传时生成/从 ID3 提取，加到 `/list` 下发），
或**在 UI 上禁掉「封面模糊」选项**（诚实但少个功能）。目前两者都没做。

### 7.2 两条路由无入口

`/search` 与 `/playlist/:id` 在 `router/index.ts` 里注册了、组件也都在，但**全仓没有一处链接或
`router.push` 指向它们**。其中 `/search` 的功能已被主页自带的「歌曲搜索」tab 完全覆盖。

**已决定**：这两块代码**保留不删**（歌单功能未来补入口）。要补的是入口，不是组件。
歌单相关共 7 个文件：`services/playlist.ts` · `types/playlist.ts` · `composables/usePlaylist.ts` ·
`views/PlaylistView.vue` · `components/playlist/{MyPlaylists,PlaylistPanel,PlaylistItem}.vue`。

### 7.3 首屏时长显示 `--:--`

`/list` 不下发 duration，靠挂载后 6s 的 `fillDurations()` 后台补，期间列表里全是 `--:--`。
延迟 6s 是**故意**的（避开首屏起播抢带宽）。若要更早显示，得让 Worker 在 `/list` 里带上时长
（`durations.json` 已经在 R2 里，成本不高）。

### 7.4 播放卡顿（**未解决，主页体验的主要瓶颈**）

根因在国内到 Cloudflare 的链路本身，与代码无关：点播放后 1~2 分钟才出声、进度与歌词不同步。
已在 hls.js 参数与 `services/prefetch.ts`（并行预取）上做了缓解。
**治本 = 音频迁国内对象存储**（阿里云 OSS / 腾讯 COS），需重传约 1 GB 并改 Worker/前端地址。
详见项目记忆第 4 节。

> 注意：库已全量转 mp3，`prefetch.ts` 的 m3u8 分片预取对 mp3 URL 实际是空操作。
> hls.js 与 HLS 代码路径**按决定保留**（未来可能传 HLS 源），但这条缓解手段目前不生效。

### 7.5 首屏自动播放可能被拦截

`seedQueue()` 无用户手势，浏览器会拒绝 `play()`。当前是 1.2s 后回滚按钮状态，
**没有**给「点一下继续播放」的显式引导。属于可打磨项，不是 bug。

---

## 八、验证清单

```
1  npm run dev → 首屏三区域（顶栏 / 左列表 / 右面板）完整渲染
2  点列表任意曲目 → 出声 + 当前行高亮 + 右栏歌名/唱片刻度 + 歌词跟随滚动居中
3  三个页签切换正常；音乐夹二级钻取与「‹ 返回」正常
4  搜索 tab 输入实时过滤，结果数正确
5  顶栏四个按钮：播客跳转 / 说明弹层 / 背景三选一 / 倍速浮层（窄条、贴按钮下方）
6  手机宽度（≤900px）：「词」按钮出现 → 点开歌词浮层 → 底部播放控制仍可用 → ✕ 关闭
7  ≤767px：底栏三行，进度条可见可拖（触摸拖动跟手），⏪15 / ⏩15 生效
8  Loading 显示 Spinner，`/list` 失败显示 ErrorMessage + 重试
9  硬刷新后首屏若被浏览器拦截自动播放，按钮状态不应停在「暂停中」
```

---

## 九、不再适用的旧计划条目

留档，避免以后有人照着旧文档找代码：

| 旧计划条目 | 现状 |
|---|---|
| Hero 区（大标题 + 曲库统计 + 浏览入口） | ❌ 未实现。曲库统计没有；「浏览音乐」在顶栏 |
| 精选艺人网格（ArtistCard 4/3/2 列） | ❌ 主页没有。`ArtistCard` 只被 `ArtistList` → `BrowseView`（/browse）使用 |
| 绿色音乐可视化 / 柱状均衡器 | ❌ 完全未实现，代码零残留。主色也早已改为红粉 |
| 精选曲目（默认歌单 top 10） | ❌ 未实现。首屏队列由 `seedQueue()` 用「曲目最多的艺人」填充 |
| 最近播放横向列表 | ❌ 主页没有。`userStore.playHistory` 存在，但只在设置页用 |
| 「删除推荐歌曲 / 郑源精选 / 全部音乐三个 section」 | ⚠️ 无从谈起 —— 主页已整页重写，这些 section 从来不存在于当前实现 |
| 只改 `HomeView.vue` 一个文件 | ⚠️ 实际改版动了 `AppLayout` / `AppHeader` / `AppFooter` / 全部视图 + `variables.css` + `global.css` |
| 不改 `AppSidebar.vue` | ⚠️ 该组件后来被**卸载并删除**（2026-10-12 清理，用户要求移除左侧菜单） |
