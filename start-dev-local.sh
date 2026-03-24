#!/bin/bash
# Local Development Start Script (No Docker Required)
# This runs services directly for faster frontend testing

set -e

echo "🚀 Starting Stock Market Agent - Local Development Mode"
echo ""

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
export NODE_ENV=development
export JWT_SECRET=dev_secret_key_12345667890
export JWT_EXPIRY=24h

# Check if tmux is installed (for multiple terminals)
if ! command -v tmux &> /dev/null; then
    echo "⚠️  tmux not found. Running services sequentially in separate terminals."
    echo ""
    echo "📝 Manual Setup - Run these in separate PowerShell/Terminal windows:"
    echo ""
    echo "Terminal 1 (Auth Service):"
    echo "  cd services/auth-service"
    echo "  set NODE_ENV=development"
    echo "  npm install && npm start"
    echo ""
    echo "Terminal 2 (API Gateway):"
    echo "  cd apps/gateway"
    echo "  npm install && npm start"
    echo ""
    echo "Terminal 3 (Web App):"
    echo "  cd apps/web"
    echo "  npm install && npm run dev"
    echo ""
    echo "✨ Once all are running, visit: http://localhost:3000/login"
    echo "📝 Test Credentials:"
    echo "   Email: demo@tradepro.com"
    echo "   Password: Demo@123456"
    exit 0
fi

# Use tmux to run services
SESSION="stock-market-dev"

# Kill existing session if it exists
tmux kill-session -t $SESSION 2>/dev/null || true

# Create new session
tmux new-session -d -s $SESSION

# Window 1: Auth Service
tmux new-window -t $SESSION -n auth "cd services/auth-service && npm install && NODE_ENV=development npm start"

# Window 2: API Gateway  
tmux new-window -t $SESSION -n gateway "cd apps/gateway && npm install && npm start"

# Window 3: Web App
tmux new-window -t $SESSION -n web "cd apps/web && npm install && npm run dev"

# Attach to session
echo -e "${GREEN}✅ Started all services in tmux${NC}"
echo ""
echo -e "${BLUE}Tmux Session: $SESSION${NC}"
echo ""
echo "Available windows:"
echo "  - auth    (Auth Service on port 3001)"
echo "  - gateway (API Gateway on port 3000)"
echo "  - web     (Frontend on port 3000)"
echo ""
echo "To switch windows: Ctrl+B then N (next) or P (previous)"
echo "To detach: Ctrl+B then D"
echo "To re-attach: tmux attach -t $SESSION"
echo ""
echo "🌐 Visit: http://localhost:3000/login"
echo "📝 Test Email: demo@tradepro.com"
echo "📝 Test Password: Demo@123456"
echo ""
tmux attach -t $SESSION
