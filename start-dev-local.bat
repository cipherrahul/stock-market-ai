@echo off
REM Local Development Start Script for Windows PowerShell
REM This runs services for frontend testing without Docker

color 0A
title Stock Market Agent - Local Development

echo.
echo ========================================
echo.  Stock Market Agent - Local Dev Mode
echo ========================================
echo.

REM Check Node.js installation
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    color 0C
    echo ERROR: Node.js is not installed or not in PATH
    echo Download from: https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo ✓ Node.js found
echo.
echo ========================================
echo  SETUP INSTRUCTIONS
echo ========================================
echo.
echo You will need to open 3 separate PowerShell windows.
echo Copy and paste these commands into each:
echo.
echo.
echo [TERMINAL 1] Auth Service (port 3001)
echo =========================================
echo $env:NODE_ENV='development'; cd services/auth-service; npm install; npm start
echo.
echo.
echo [TERMINAL 2] API Gateway (port 3000)
echo =========================================
echo cd apps/gateway; npm install; npm start
echo.
echo.
echo [TERMINAL 3] Web App (port 3000)  
echo =========================================
echo cd apps/web; npm install; npm run dev
echo.
echo.
echo ========================================
echo  TEST CREDENTIALS
echo ========================================
echo.
echo Email:    demo@tradepro.com
echo Password: Demo@123456
echo.
echo Once all 3 services are running:
echo Open browser: http://localhost:3000/login
echo.
echo.
echo ========================================
echo  QUICK START
echo ========================================
echo.
echo Or run this in VS Code's Integrated Terminal:
echo Replace-Item -Path Env:NODE_ENV -Value "development"
echo.
pause
