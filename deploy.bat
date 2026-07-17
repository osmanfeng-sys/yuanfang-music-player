@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: --- 变量配置 ---
set PROJECT_NAME=yuanfang-music
set WORKER_NAME=music-proxy
set LIST_SCRIPT=list-r2.js

echo [1/5] 安装依赖...
call npm ci
if %errorlevel% neq 0 exit /b 1

echo [2/5] 生成音乐索引...
call node %LIST_SCRIPT%

echo [3/5] 同步 Git...
:: 强制暂存所有更改，处理“unstaged changes”问题
git add .
git commit -m "chore: auto-update playlist"
:: 变基前先拉取，如果存在冲突，需手动解决或使用 fetch+reset
git pull origin main --rebase
if %errorlevel% neq 0 (
    echo [Error] Git 同步失败，请检查冲突。
    exit /b 1
)
git push origin main

echo [4/5] 部署 Pages...
npx wrangler pages deploy . --project-name=%PROJECT_NAME%

echo [5/5] 部署 Worker...
npx wrangler deploy worker.js --name %WORKER_NAME%

echo [Success] 部署流程执行完毕。
pause