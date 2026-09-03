@echo off
REM ===== OST All-in-One: start the app =====
cd /d "%~dp0"
echo.
echo ============================================
echo   Starting the Open Startup platform...
echo.
echo   When you see "running at http://localhost:5000",
echo   open that address in your web browser.
echo.
echo   Keep THIS window open while you use the app.
echo   Close it (or press Ctrl+C) to stop the app.
echo ============================================
echo.
call npm run dev
pause
