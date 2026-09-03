@echo off
REM ===== OST All-in-One: one-time setup / update =====
cd /d "%~dp0"
echo.
echo ============================================
echo   Setting up / updating the platform...
echo   This can take a few minutes. Please wait.
echo ============================================
echo.
echo [1/2] Installing components (npm install)...
call npm install
if %errorlevel% neq 0 (
  echo.
  echo *** Install failed. Make sure Node.js is installed. ***
  echo.
  pause
  exit /b 1
)
echo.
echo [2/2] Updating the database...
call npm run db:migrate
if %errorlevel% neq 0 (
  echo.
  echo *** Database update failed. Check your DATABASE_URL in .env. ***
  echo.
  pause
  exit /b 1
)
echo.
echo ============================================
echo   Setup complete - you can close this window.
echo   Next: double-click 2-start.bat
echo ============================================
echo.
pause
