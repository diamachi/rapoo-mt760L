@echo off
cd /d "%~dp0"
"_toolchain\portable-node-windows-x64\node.exe" scripts\launch-app.mjs
pause
