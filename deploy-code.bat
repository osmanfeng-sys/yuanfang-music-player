@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: --- 变量配置 ---
set PROJECT_NAME=yuanfang-music
set WORKER_NAME=music-proxy

echo ╔═════════════════════════════════════╗
echo ║   远方音乐播放器 — 代码部署          ║
echo ║   (跳过音乐列表同步)                  ║
echo ╚═════════════════════════════════════╝
echo.

:: ─── 步骤 1: 安装前端依赖 ───
echo [1/4] 安装前端依赖...
call npm install
if %errorlevel% neq 0 (
    echo [Error] npm install 失败
    pause
    exit /b 1
)
echo ✓ 前端依赖安装完成
echo.

:: ─── 步骤 2: 同步 Git ───
echo [2/4] 同步 Git 仓库...
git add .
git commit -m "chore: update code"
git pull origin main --rebase
if %errorlevel% neq 0 (
    echo [Error] Git 同步失败，请手动解决冲突后再试
    pause
    exit /b 1
)
git push origin main
echo ✓ Git 推送成功
echo.

:: ─── 步骤 3: 构建并部署前端到 Cloudflare Pages ───
echo [3/4] 构建前端并部署到 Cloudflare Pages...
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

:: ─── 步骤 4: 构建并部署 Worker ───
echo [4/4] 构建并部署 Cloudflare Worker...
pushd worker
call npm install
if %errorlevel% neq 0 (
    echo [Warning] Worker 依赖安装失败，跳过 Worker 部署
    popd
    goto :done
)
call npm run build
if %errorlevel% neq 0 (
    echo [Error] Worker 构建失败
    popd
    pause
    exit /b 1
)
popd

npx wrangler deploy worker/dist/worker.js --name %WORKER_NAME%
if %errorlevel% neq 0 (
    echo [Error] Worker 部署失败，请检查 CLOUDFLARE_API_TOKEN
    pause
    exit /b 1
)
echo ✓ Worker 部署完成
echo.

:done
echo.
echo ╔═════════════════════════════════════╗
echo ║   ✓ 代码部署完成！                    ║
echo ║                                      ║
echo ║   前端: https://%PROJECT_NAME%.pages.dev ║
echo ║   API:  https://api.yuanfangorganics.ccwu.cc ║
echo ╚═════════════════════════════════════╝
echo.

pause
