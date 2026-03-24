@echo off
REM 🚀 REALTIME SYSTEM QUICK START (Windows)
REM This script starts all services needed for 100% realtime trading

setlocal enabledelayedexpansion

echo.
echo 🚀 Starting 100%% Realtime Trading System on Windows...
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    echo    Install from: https://nodejs.org/
    exit /b 1
)

echo ✅ Node.js found: %NODE_VERSION%
echo.

REM Function to check if port is in use (requires netstat)
setlocal enabledelayedexpansion

REM Start Market Data Service (Real-time price stream)
echo.
echo [1/9] Starting Market Data Service (Port 3003)...
echo.

cd services\market-data-service
call npm install --silent
if exist src\index_realtime.ts (
    start "Market Data Service" cmd /k "npm start"
    echo ✅ Market Data Service started
    timeout /t 3 /nobreak
) else (
    echo ❌ File src\index_realtime.ts not found
    exit /b 1
)

cd ..\..\

REM Start API Gateway with WebSocket support
echo.
echo [2/9] Starting API Gateway with WebSocket (Port 3000)...
echo.

cd apps\gateway
call npm install --silent
if exist src\index_realtime.ts (
    start "API Gateway (WebSocket)" cmd /k "npm start"
    echo ✅ API Gateway started
    timeout /t 2 /nobreak
) else (
    echo ❌ File src\index_realtime.ts not found
    exit /b 1
)

cd ..\..\

REM Start Auth Service
echo [3/9] Starting Auth Service (Port 3001)...
cd services\auth-service
call npm install --silent
start "Auth Service" cmd /k "npm start"
timeout /t 2 /nobreak
cd ..\..\

REM Start Portfolio Service
echo [4/9] Starting Portfolio Service (Port 3005)...
cd services\portfolio-service
call npm install --silent
start "Portfolio Service" cmd /k "npm start"
timeout /t 2 /nobreak
cd ..\..\

REM Start Trading Engine
echo [5/9] Starting Trading Engine (Port 3006)...
cd services\trading-engine-service
call npm install --silent
start "Trading Engine" cmd /k "npm start"
timeout /t 2 /nobreak
cd ..\..\

REM Start AI Engine
echo [6/9] Starting AI Engine (Port 3004)...
cd services\ai-engine-service
call npm install --silent
start "AI Engine" cmd /k "npm start"
timeout /t 2 /nobreak
cd ..\..\

REM Start Risk Management
echo [7/9] Starting Risk Management (Port 3010)...
cd services\risk-management-service
call npm install --silent
start "Risk Management" cmd /k "npm start"
timeout /t 2 /nobreak
cd ..\..\

REM Start Notification Service
echo [8/9] Starting Notification Service (Port 3009)...
cd services\notification-service
call npm install --silent
start "Notification Service" cmd /k "npm start"
timeout /t 2 /nobreak
cd ..\..\

echo.
echo [9/9] All services started!
echo.

echo ═══════════════════════════════════════════════════════════════
echo ✅ 100%% REALTIME SYSTEM STARTED
echo ═══════════════════════════════════════════════════════════════
echo.

echo 📊 Services Running:
echo   🌐 API Gateway:          http://localhost:3000
echo   📡 WebSocket:            ws://localhost:3000/ws
echo   📍 Market Data:          http://localhost:3003
echo   🔐 Auth Service:         http://localhost:3001
echo   💼 Portfolio Service:    http://localhost:3005
echo   📈 Trading Engine:       http://localhost:3006
echo   🤖 AI Engine:            http://localhost:3004
echo   ⚠️  Risk Management:     http://localhost:3010
echo   🔔 Notification Service: http://localhost:3009
echo.

echo 🚀 Quick Start:
echo   1. Frontend: cd apps\web && npm start
echo   2. Verify: powershell -Command "& { Invoke-WebRequest http://localhost:3000/health }"
echo   3. Check WebSocket: Open browser and check console
echo.

echo 📖 Documentation:
echo   - Full Guide: type REALTIME_SYSTEM_GUIDE.md
echo   - Audit Report: type PRODUCTION_READINESS_AUDIT.md
echo   - Executive Brief: type EXECUTIVE_BRIEF.md
echo.

echo 🛑 To stop all services: Press Ctrl+C in each window or use:
echo    taskkill /F /IM node.exe
echo.

echo All service windows will remain open. You can close them individually when done.
pause
