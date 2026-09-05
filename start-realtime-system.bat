@echo off
REM 🚀 MULTI-AGENT REALTIME SYSTEM QUICK START (Windows)
REM Starts the unified trading and multi-agent intelligence stack

setlocal enabledelayedexpansion

echo.
echo ===================================================================
echo 🦅 SOVEREIGN MULTI-AGENT TRADING SYSTEM (State-of-the-Art Architecture)
echo ===================================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo ❌ Node.js is not installed or not in PATH
    exit /b 1
)

REM 1. Start API Gateway (Port 3000 + WebSocket ws://localhost:3000/ws)
echo [1/5] Starting API Gateway & WebSocket Router (Port 3000)...
cd apps\gateway
start "API Gateway & WebSockets" cmd /k "npm run dev"
timeout /t 2 /nobreak
cd ..\..\

REM 2. Start Multi-Agent Python Engine (Port 3004)
echo [2/5] Starting Multi-Agent AI Engine (Port 3004)...
cd services\ai-engine-service
if exist .venv\Scripts\python.exe (
    start "Multi-Agent AI Engine" cmd /k ".venv\Scripts\python.exe -m uvicorn main:app --port 3004 --reload"
) else (
    start "Multi-Agent AI Engine" cmd /k "python -m uvicorn main:app --port 3004 --reload"
)
timeout /t 2 /nobreak
cd ..\..\

REM 3. Start Market Data Service (Port 3003)
echo [3/5] Starting Market Data Service (Port 3003)...
cd services\market-data-service
start "Market Data Service" cmd /k "npm start"
timeout /t 2 /nobreak
cd ..\..\

REM 4. Start Trading Engine (Port 3006)
echo [4/5] Starting Trading Engine (Port 3006)...
cd services\trading-engine-service
start "Trading Engine" cmd /k "npm start"
timeout /t 2 /nobreak
cd ..\..\

REM 5. Start Agent Orchestrator (Port 3012)
echo [5/5] Starting Agent Orchestrator (Port 3012)...
cd services\agent-orchestrator
start "Agent Orchestrator" cmd /k "npm run dev"
timeout /t 2 /nobreak
cd ..\..\

echo.
echo ===================================================================
echo ✅ MULTI-AGENT TRADING ECOSYSTEM STARTED
echo ===================================================================
echo.
echo 📊 Active Endpoints:
echo   🌐 API Gateway:          http://localhost:3000
echo   📡 WebSocket Feed:       ws://localhost:3000/ws
echo   🧠 Multi-Agent Engine:   http://localhost:3004
echo   📡 Market Data:          http://localhost:3003
echo   📈 Trading Engine:       http://localhost:3006
echo   🦅 Agent Orchestrator:   http://localhost:3012
echo.
echo 🚀 Next.js Frontend Dashboard:
echo   Run: cd apps\web ^&^& npm run dev
echo   URL: http://localhost:3000 or http://localhost:5000
echo.
echo 🛑 To stop all services: Press Ctrl+C in each window or run:
echo    taskkill /F /IM node.exe /IM python.exe
echo.
pause
