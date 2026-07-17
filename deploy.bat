@echo off
setlocal

echo [Step 1] 正在生成最新音乐列表...
call node list-r2.js
if %errorlevel% neq 0 (
    echo [Error] 列表生成失败，部署终止。
    pause
    exit /b 1
)

echo [Step 2] 同步 Git 分支...
git pull origin main --rebase
git add .
git commit -m "自动部署：更新Playlist及后端逻辑"
git push origin main

echo [Step 3] 正在部署 Cloudflare Pages...
:: 自动部署当前目录，确保 wrangler.toml 已正确配置
npx wrangler pages deploy . --project-name=yuanfang-music
if %errorlevel% neq 0 (
    echo [Error] Pages 部署失败。
    pause
    exit /b 1
)

echo [Step 4] 正在部署 Worker 代理...
:: 显式指定名称，防止部署环境覆盖错误
npx wrangler deploy worker.js --name music-proxy
if %errorlevel% neq 0 (
    echo [Error] Worker 部署失败。
    pause
    exit /b 1
)

echo [Success] 全部部署流程已完成！
pause