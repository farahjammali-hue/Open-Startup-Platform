@echo off
REM ===== OST All-in-One: apply database changes =====
cd /d "%~dp0"
echo.
echo Updating your database (adding new fields)...
echo.
call npm run db:migrate
echo.
if %errorlevel% neq 0 (
  echo *** Update failed. Send Claude a screenshot of this window. ***
) else (
  echo Done. Go back to your browser and try logging in again.
)
echo.
pause
