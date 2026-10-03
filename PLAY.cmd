@echo off
setlocal
cd /d "%~dp0"
set "FC_NODE=node"
where node >nul 2>nul
if errorlevel 1 (
  set "FC_NODE=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
  if not exist "%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" (
    echo Install Node.js 24, then run this launcher again.
    pause
    exit /b 1
  )
)
start "" "http://127.0.0.1:4180/frontier-command/"
"%FC_NODE%" scripts\serve.mjs
pause
