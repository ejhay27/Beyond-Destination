@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to start the local game runtime.
  echo Install Node.js 20.19+ or 22.12+, then run npm install in this folder.
  pause
  exit /b 1
)
if not exist node_modules\vite\bin\vite.js (
  echo Dependencies are not installed yet. Run npm install from this folder first.
  pause
  exit /b 1
)
start "Beyond Destination local runtime" /min cmd /c "npm run dev -- --host 127.0.0.1 --strictPort"
timeout /t 2 /nobreak >nul
start "" http://127.0.0.1:5173
endlocal
