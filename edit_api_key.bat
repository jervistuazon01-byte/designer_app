@echo off
setlocal
cd /d "%~dp0"

echo ==================================================
echo   NANO BANANA - API KEY SETUP
echo ==================================================
echo.

:SETUP_KEY
echo [SETUP] Please enter your Google Gemini API Key.
echo (It starts with "AIza..." - Get it from aistudio.google.com)
echo.
set /p APIKEY="Paste Key > "

if "%APIKEY%"=="" (
    echo [ERROR] You must provide a key!
    goto :SETUP_KEY
)

echo GOOGLE_API_KEY=%APIKEY% > .env
echo.
echo [SUCCESS] Key saved to .env!
echo.
echo You can now run 'start_app.bat' to launch the server.
echo.
pause
