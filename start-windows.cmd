@echo off
cd /d "%~dp0"
"_toolchain\node26\node.exe" scripts\launch-app.mjs
pause
