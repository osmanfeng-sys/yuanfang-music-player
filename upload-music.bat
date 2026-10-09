@echo off
rem 故意不设 chcp：Windows 控制台的「拖放文件到窗口」依赖控制台代码页，
rem chcp 65001 会让拖放失效。Node 在 TTY 下用宽字符 console API，
rem 中文的显示与输入都不需要改代码页。
cd /d "%~dp0"
node --env-file-if-exists=.env upload-music.mjs %*
echo.
pause
