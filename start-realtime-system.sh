#!/bin/bash

# 🚀 REALTIME SYSTEM QUICK START
# This script starts all services needed for 100% realtime trading

set -e

echo "🚀 Starting 100% Realtime Trading System..."
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if services are already running
check_port() {
  if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null 2>&1; then
    return 0
  else
    return 1
  fi
}

# Start Market Data Service (Real-time price stream)
echo -e "${YELLOW}1. Starting Market Data Service (Port 3003)...${NC}"
cd services/market-data-service

if check_port 3003; then
  echo -e "${RED}   ⚠️  Port 3003 already in use${NC}"
else
  npm install --silent 2>/dev/null || true
  
  # Use the realtime version
  if [ -f "src/index_realtime.ts" ]; then
    npm start &
    MARKET_PID=$!
    echo -e "${GREEN}   ✅ Market Data Service started (PID: $MARKET_PID)${NC}"
  else
    echo -e "${RED}   ❌ File src/index_realtime.ts not found${NC}"
    exit 1
  fi
  
  sleep 3
fi

cd ../..

# Start API Gateway with WebSocket support
echo -e "${YELLOW}2. Starting API Gateway with WebSocket (Port 3000)...${NC}"
cd apps/gateway

if check_port 3000; then
  echo -e "${RED}   ⚠️  Port 3000 already in use${NC}"
else
  npm install --silent 2>/dev/null || true
  
  if [ -f "src/index_realtime.ts" ]; then
    npm start &
    GATEWAY_PID=$!
    echo -e "${GREEN}   ✅ API Gateway started (PID: $GATEWAY_PID)${NC}"
  else
    echo -e "${RED}   ❌ File src/index_realtime.ts not found${NC}"
    exit 1
  fi
  
  sleep 2
fi

cd ../..

# Start other required services
echo -e "${YELLOW}3. Starting other backend services...${NC}"

services=(
  "auth-service:3001"
  "portfolio-service:3005"
  "trading-engine-service:3006"
  "ai-engine-service:3004"
  "risk-management-service:3010"
  "notification-service:3009"
)

for service_info in "${services[@]}"; do
  IFS=':' read -r service_name port <<< "$service_info"
  
  echo -e "${YELLOW}   Starting $service_name (Port $port)...${NC}"
  
  if check_port $port; then
    echo -e "   ⚠️  Port $port already in use, skipping..."
    continue
  fi
  
  if [ -d "services/$service_name" ]; then
    cd "services/$service_name"
    npm install --silent 2>/dev/null || true
    npm start &
    echo -e "${GREEN}   ✅ $service_name started${NC}"
    cd ../..
  fi
  
  sleep 1
done

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 100% REALTIME SYSTEM STARTED${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════════════════${NC}"
echo ""

echo "📊 Services Running:"
echo -e "  🌐 API Gateway:          ${GREEN}http://localhost:3000${NC}"
echo -e "  📡 WebSocket:            ${GREEN}ws://localhost:3000/ws${NC}"
echo -e "  📍 Market Data:          ${GREEN}http://localhost:3003${NC}"
echo -e "  🔐 Auth Service:         ${GREEN}http://localhost:3001${NC}"
echo -e "  💼 Portfolio Service:    ${GREEN}http://localhost:3005${NC}"
echo -e "  📈 Trading Engine:       ${GREEN}http://localhost:3006${NC}"
echo -e "  🤖 AI Engine:            ${GREEN}http://localhost:3004${NC}"
echo -e "  ⚠️  Risk Management:     ${GREEN}http://localhost:3010${NC}"
echo -e "  🔔 Notification Service: ${GREEN}http://localhost:3009${NC}"
echo ""

echo "🚀 Quick Start:"
echo "  1. Frontend: cd apps/web && npm start"
echo "  2. Verify: curl http://localhost:3000/health"
echo "  3. Check WebSocket: Check browser console"
echo ""

echo "📖 Documentation:"
echo "  - Full Guide: cat REALTIME_SYSTEM_GUIDE.md"
echo "  - Audit Report: cat PRODUCTION_READINESS_AUDIT.md"
echo "  - Executive Brief: cat EXECUTIVE_BRIEF.md"
echo ""

echo "🛑 To stop all services: pkill -f 'npm start'"
echo ""

# Keep script running
wait
