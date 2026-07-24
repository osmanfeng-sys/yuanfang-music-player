@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ╔═════════════════════════════════════╗
echo ║   远方音乐播放器 — 音乐列表同步       ║
echo ║   (扫描 R2 + 上传索引 + 推送 Git)     ║
echo ╚═════════════════════════════════════╝
echo.

:: ─── 步骤 1: 生成并上传音乐索引 ───
echo [1/2] 扫描 R2 生成音乐索引并上传...
call npm run generate:playlist
if %errorlevel% neq 0 (
    echo [Error] 索引生成失败，请检查 .env 中的 R2 凭证
    pause
    exit /b 1
)
echo ✓ 音乐索引已更新并同步到 R2
echo.

:: ─── 步骤 2: 提交 playlist.json 到 Git ───
echo [2/2] 提交音乐列表更新到 Git...
git add playlist.json
git commit -m "chore: update playlist (%DATE% %TIME%)"
git pull origin main --rebase
if %errorlevel% neq 0 (
    echo [Error] Git 同步失败，请手动解决冲突后再试
    pause
    exit /b 1
)
git push origin main
echo ✓ Git 推送成功
echo.

echo ╔═════════════════════════════════════╗
echo ║   ✓ 音乐列表同步完成！                ║
echo ║                                      ║
echo ║   后续 GitHub Actions 将自动部署      ║
echo ╚═════════════════════════════════════╝
echo.

pause
