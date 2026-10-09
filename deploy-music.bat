@echo off
rem NOTE: keep this file pure ASCII. cmd reads .bat with the system code page, so
rem UTF-8 CJK text here shows up as mojibake and can even be run as commands.
rem
rem [1/2] scan R2 and rebuild playlist.json (it also uploads the index back to R2)
rem [2/2] commit the index and push -> GitHub Actions deploys the site
cd /d "%~dp0"

echo [1/2] Scanning R2 and rebuilding playlist.json ...
call npm run generate:playlist
if errorlevel 1 (
    echo.
    echo [Error] generate:playlist failed. Check the R2 credentials in .env
    pause
    exit /b 1
)

echo.
echo [2/2] Committing playlist.json and pushing ...
git add playlist.json
git commit -m "chore: update playlist"
git pull origin main --rebase
if errorlevel 1 (
    echo.
    echo [Error] git sync failed. Resolve the conflict manually, then re-run.
    pause
    exit /b 1
)
git push origin main
if errorlevel 1 (
    echo.
    echo [Error] git push failed. GitHub usually needs the WARP/proxy on - retry after enabling it.
    pause
    exit /b 1
)

echo.
echo Done. GitHub Actions will deploy in about a minute.
echo (Hard-refresh the site with Ctrl+F5 afterwards.)
pause
