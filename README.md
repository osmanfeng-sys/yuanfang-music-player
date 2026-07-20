# 远方音乐播放器 (yuanfang-music-player)

一个基于 Cloudflare Pages + Worker + R2 的在线 HLS 音乐播放器。

## 项目结构

```
yuanfang-music-player/
├── index.html          # 前端入口（当前为 Vanilla JS 版本）
├── worker.js           # Cloudflare Worker（R2 代理 + /list API）
├── list-r2.js          # R2 扫描脚本：扫描 bucket 生成 playlist.json
├── playlist.json       # 音乐索引（由 list-r2.js 自动生成）
├── deploy.bat          # Windows 本地部署脚本
├── wrangler.toml       # Cloudflare 配置
├── .env.example        # 环境变量模板（复制为 .env 并填入凭证）
└── project-plan.md     # Vue 3 + TypeScript 重构实施计划
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置凭证

复制 `.env.example` 为 `.env`，填入你的 R2 凭证。

### 3. 生成音乐索引

```bash
npm run generate:playlist
```

### 4. 本地调试 Worker

```bash
npx wrangler dev worker.js
```

### 5. 部署

#### CI/CD（推荐）
推送至 `main` 分支 → GitHub Actions 自动部署。

#### 手动部署

```bash
# 部署 Pages（前端）
npx wrangler pages deploy . --project-name=yuanfang-music

# 部署 Worker
npx wrangler deploy worker.js --name music-proxy
```

或一键本地部署：

```bash
npm run deploy:local
```

## 重构计划

参见 [project-plan.md](./project-plan.md) — 将重构为 Vue 3 + TypeScript + Vite 架构。
