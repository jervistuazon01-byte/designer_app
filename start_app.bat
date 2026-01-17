@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

echo ==================================================
echo   DESIGNER - LOCAL SERVER
echo ==================================================
echo.

:: 1. Check for Node.js
node -v >nul 2>&1
if %errorlevel% neq 0 goto :NO_NODE

:: 2. Check for API Key
if not exist ".env" goto :NO_KEY

:: 3. Install Dependencies (if missing)
if not exist "node_modules" goto :INSTALL_DEPS
goto :START_APP

:INSTALL_DEPS
echo [INFO] Installing libraries (First Run Only)...
call npm init -y >nul 2>&1
call npm install express dotenv cors >nul 2>&1
goto :START_APP

:START_APP
:: 4. Pick an available port (default 3001)
set "PORT=3001"
call :FIND_OPEN_PORT
if %errorlevel% neq 0 exit /b 1

echo.
echo [INFO] Starting Application on port %PORT%...
echo [INFO] Your Browser should open automatically...
echo.

start "" "http://localhost:%PORT%"

:: Run Server (This stays open)
node server.js

:: If node crashes or exits, pause so user can see why
echo.
echo [WARNING] Server stopped unexpectedly.
pause
exit /b

:FIND_OPEN_PORT
set /a _tries=0
:CHECK_PORT
set "IN_USE="
for /f "delims=" %%A in ('netstat -ano ^| findstr /R /C:":%PORT% " 2^>nul') do set "IN_USE=1"
if defined IN_USE (
    set /a PORT+=1
    set /a _tries+=1
    if !_tries! LSS 20 goto CHECK_PORT
    echo [ERROR] Could not find a free port starting at 3001.
    exit /b 1
)
exit /b 0

:NO_NODE
echo [ERROR] Node.js is NOT installed!
echo Please download it from https://nodejs.org/
echo Install it, restart your computer, and try again.
pause
exit /b

:NO_KEY
echo [ERROR] No API Key configuration found!
echo.
echo Please run 'edit_api_key.bat' first to set up your key.
echo.
pause
exit /b
