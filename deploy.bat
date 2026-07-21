@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: --- 变量配置 ---
set PROJECT_NAME=yuanfang-music
set WORKER_NAME=music-proxy
set LIST_SCRIPT=list-r2.js

echo ╔═════════════════════════════════════╗
echo ║   远方音乐播放器 — 一键部署脚本      ║
echo ╚═════════════════════════════════════╝
echo.

:: ─── 步骤 1: 安装前端依赖 ───
echo [1/6] 安装前端依赖...
call npm ci
if %errorlevel% neq 0 (
    echo [Error] npm ci 失败
    pause
    exit /b 1
)
echo ✓ 前端依赖安装完成
echo.

:: ─── 步骤 2: 生成音乐索引 ───
echo [2/6] 扫描 R2 生成音乐索引...
call node %LIST_SCRIPT%
if %errorlevel% neq 0 (
    echo [Error] 索引生成失败，请检查 .env 中的 R2 凭证
    pause
    exit /b 1
)
echo ✓ 音乐索引已更新 (playlist.json)
echo.

:: ─── 步骤 3: 安装 Worker 依赖 ───
echo [3/6] 安装 Worker 依赖...
pushd worker
call npm ci
if %errorlevel% neq 0 (
    echo [Warning] Worker 依赖安装失败，跳过 Worker 部署
    set WORKER_FAILED=1
)
popd
echo ✓ Worker 依赖安装完成
echo.

:: ─── 步骤 4: 同步 Git（提交 playlist.json 更新） ───
echo [4/6] 同步 Git 仓库...
git add .
git commit -m "chore: auto-update playlist"
:: 拉取远端变更，避免推送冲突
git pull origin main --rebase
if %errorlevel% neq 0 (
    echo [Error] Git 同步失败，请手动解决冲突后再试
    pause
    exit /b 1
)
git push origin main
echo ✓ Git 推送成功
echo.

:: ─── 步骤 5: 构建并部署前端到 Cloudflare Pages ───
echo [5/6] 构建前端并部署到 Cloudflare Pages...
call npm run build
if %errorlevel% neq 0 (
    echo [Error] 前端构建失败
    pause
    exit /b 1
)

npx wrangler pages deploy dist --project-name=%PROJECT_NAME%
if %errorlevel% neq 0 (
    echo [Error] Pages 部署失败，请检查 CLOUDFLARE_API_TOKEN
    pause
    exit /b 1
)
echo ✓ Pages 部署完成
echo.

:: ─── 步骤 6: 构建并部署 Worker ───
echo [6/6] 构建并部署 Cloudflare Worker...
if "%WORKER_FAILED%"=="1" (
    echo [跳过] Worker 依赖未安装，跳过部署
) else (
    pushd worker
    call npm run build
    if !errorlevel! neq 0 (
        echo [Error] Worker 构建失败
        popd
        pause
        exit /b 1
    )
    popd

    npx wrangler deploy worker/dist/worker.js --name %WORKER_NAME%
    if !errorlevel! neq 0 (
        echo [Error] Worker 部署失败，请检查 CLOUDFLARE_API_TOKEN
        pause
        exit /b 1
    )
    echo ✓ Worker 部署完成
)

echo.
echo ╔═════════════════════════════════════╗
echo ║   ✓ 全部部署完成！                    ║
echo ║                                      ║
echo ║   前端: https://%PROJECT_NAME%.pages.dev ║
echo ║   API:  https://%WORKER_NAME%.osmanfeng.workers.dev ║
echo ╚═════════════════════════════════════╝
echo.
echo 提示：自定义域名已配置，前端可通过
echo        https://yuanfangorganics.ccwu.cc 访问
echo.

pause
