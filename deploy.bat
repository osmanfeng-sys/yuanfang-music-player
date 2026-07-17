@echo off
setlocal enabledelayedexpansion

:: --- 配置信息 ---
set PROJECT_NAME=yuanfang-music
set WORKER_NAME=music-proxy
set LIST_SCRIPT=list-r2.js

echo [1/5] 正在安装生产环境依赖...
call npm ci
if %errorlevel% neq 0 (
    echo [Error] 依赖安装失败，请检查 package-lock.json.
    pause
    exit /b 1
)

echo [2/5] 正在生成音乐索引列表...
call node %LIST_SCRIPT%
if %errorlevel% neq 0 (
    echo [Error] 索引生成失败.
    pause
    exit /b 1
)

echo [3/5] 正在同步版本库...
git pull origin main --rebase
git add .
git commit -m "chore: automated deployment update"
git push origin main
if %errorlevel% neq 0 (
    echo [Error] Git 同步失败.
    pause
    exit /b 1
)

echo [4/5] 正在部署 Cloudflare Pages...
npx wrangler pages deploy . --project-name=%PROJECT_NAME%
if %errorlevel% neq 0 (
    echo [Error] Pages 部署中断[cite: 16].
    pause
    exit /b 1
)

echo [5/5] 正在部署 Worker 代理...
npx wrangler deploy worker.js --name %WORKER_NAME%
if %errorlevel% neq 0 (
    echo [Error] Worker 部署失败[cite: 16].
    pause
    exit /b 1
)

echo [Success] 部署流程执行完毕。
pause