@echo off
rem TextVault — setup & development launcher (shows a console with progress).
rem For everyday use WITHOUT a console window, double-click TextVault.vbs instead,
rem or run the packaged app: dist\TextVault\TextVault.exe
setlocal
set "HERE=%~dp0"
set "PATH=%HERE%tools\node;%PATH%"
where node >nul 2>nul || (
  echo Node.js not found. Expected portable copy at tools\node\node.exe
  echo or install Node.js from https://nodejs.org and run: npm install ^&^& npm start
  pause
  exit /b 1
)
if not exist "%HERE%node_modules\electron" (
  echo First run: installing dependencies...
  call "%HERE%tools\node\npm.cmd" install --no-audit --no-fund || (pause & exit /b 1)
)
echo Starting TextVault...
"%HERE%tools\node\npx.cmd" electron .
endlocal
