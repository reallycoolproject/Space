@echo off
setlocal

:: Get optional commit message argument or use default timestamp
set MSG=%*
if "%MSG%"=="" (
    for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
    set MSG=Sync changes: %date% %time%
)

echo [Space App] Staging changes...
git add .

echo [Space App] Committing with message: "%MSG%"
git commit -m "%MSG%"

echo [Space App] Pushing to GitHub (origin/main)...
git push origin main

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ==============================================
    echo [SUCCESS] Changes synced to GitHub successfully!
    echo https://github.com/reallycoolproject/Space
    echo ==============================================
) else (
    echo.
    echo [ERROR] Git push failed. Please check your internet or GitHub credentials.
)

pause
