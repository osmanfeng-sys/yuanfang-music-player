@echo off
rem NOTE: keep this file pure ASCII -- cmd reads .bat with the system code page,
rem so UTF-8 CJK here would turn into garbage and get run as commands.
rem NOTE: no "chcp 65001" -- it breaks drag-and-drop onto the console window.
rem
rem Why reopen in conhost: Windows Terminal currently blocks dropping files onto
rem the window (and steals focus after a drop), while the classic console host
rem inserts the quoted path just fine. Dropping a file onto a CLI is done by the
rem host process, not by this script, so switching host is the only way.
if defined WT_SESSION (
    set "WT_SESSION="
    start "" conhost.exe cmd.exe /c call "%~f0" %*
    exit /b
)

cd /d "%~dp0"
node --env-file-if-exists=.env upload-music.mjs %*
echo.
pause
