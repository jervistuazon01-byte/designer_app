@echo off
:: Safe Sync Script for Designer Web App
echo ========================================================
echo       One-Click GitHub Sync for Designer Web App
echo ========================================================
echo.

:: 1. Add all changes
echo [Step 1/4] Finding new files...
git add .

:: 2. Commit changes with a timestamp
echo [Step 2/4] Saving changes locally...
git commit -m "Update: %date% %time%"

:: 3. Pull Remote Changes (Fixes "fetch first" and "unrelated histories")
echo [Step 3/4] Pulling remote changes...
git pull origin main --allow-unrelated-histories

:: 4. Push to GitHub
echo [Step 4/4] Uploading to GitHub...
echo (If this gets stuck or asks for a login, check if a browser window opened!)
git branch -M main
git push -u origin main

echo.
echo ========================================================
echo                Sync Complete!
echo     Your app will auto-update on Render.com shortly!
echo ========================================================
echo.
pause
