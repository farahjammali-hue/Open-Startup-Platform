@echo off
REM ===== OST All-in-One: stop any running server =====
echo Stopping any running app servers...
taskkill /F /IM node.exe >nul 2>&1
if %errorlevel%==0 (
  echo Done. All Node.js processes were stopped.
) else (
  echo Nothing was running.
)
echo You can now double-click 2-start.bat
echo.
pause
