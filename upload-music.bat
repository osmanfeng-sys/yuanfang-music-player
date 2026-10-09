@echo off
rem NOTE: keep this file pure ASCII. cmd reads .bat with the system code page,
rem so UTF-8 CJK comments here turn into garbage and get run as commands.
rem NOTE: do NOT add "chcp 65001" -- it breaks drag-and-drop onto the window.
rem Node uses the wide-char console API on a TTY, so CJK needs no code page change.
cd /d "%~dp0"
node --env-file-if-exists=.env upload-music.mjs %*
echo.
pause
