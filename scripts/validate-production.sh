#!/bin/bash

# Production Setup Validation Script
# This script validates that all production prerequisites are met

set -e

echo "🔍 Production Setup Validation"
echo "=============================="
echo ""

EXIT_CODE=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check environment variables
echo "📋 Checking environment variables..."

required_env_vars=(
  "NODE_ENV"
  "JWT_SECRET"
  "JWT_REFRESH_SECRET"
  "DB_HOST"
  "DB_PORT"
  "DB_USER"
  "DB_PASSWORD"
  "DB_NAME"
  "REDIS_URL"
  "AUTH_SERVICE_URL"
  "USER_SERVICE_URL"
  "MARKET_SERVICE_URL"
  "PORTFOLIO_SERVICE_URL"
  "TRADING_SERVICE_URL"
)

missing_vars=()
for var in "${required_env_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
    echo -e "${RED}✗${NC} $var not set"
    EXIT_CODE=1
  else
    echo -e "${GREEN}✓${NC} $var configured"
  fi
done

echo ""

# Check Node version
echo "📦 Checking Node.js version..."
node_version=$(node -v)
min_version="18.0.0"

if [[ "$node_version" > "v$min_version" ]] || [[ "$node_version" == "v$min_version" ]]; then
  echo -e "${GREEN}✓${NC} Node.js $node_version (required: >= $min_version)"
else
  echo -e "${RED}✗${NC} Node.js $node_version (required: >= $min_version)"
  EXIT_CODE=1
fi

echo ""

# Check npm version
echo "📦 Checking npm version..."
npm_version=$(npm -v)
echo -e "${GREEN}✓${NC} npm $npm_version"

echo ""

# Check npm dependencies
echo "📚 Checking npm dependencies..."
if [ ! -d "node_modules" ]; then
  echo -e "${YELLOW}⚠${NC}  node_modules not found - running 'npm install'"
  npm install
fi
echo -e "${GREEN}✓${NC} npm dependencies installed"

echo ""

# Check services are compilable
echo "🔨 Checking TypeScript compilation..."
if npm run build > /dev/null 2>&1; then
  echo -e "${GREEN}✓${NC} All services compile successfully"
else
  echo -e "${RED}✗${NC} TypeScript compilation failed"
  EXIT_CODE=1
fi

echo ""

# Check database connectivity (optional - only if DB accessible)
if [ ! -z "$DB_HOST" ] && [ ! -z "$DB_PORT" ]; then
  echo "🗄️  Checking database connectivity..."
  
  # Try to connect to database
  if timeout 5 bash -c "echo >/dev/tcp/$DB_HOST/$DB_PORT" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Database host reachable ($DB_HOST:$DB_PORT)"
  else
    echo -e "${YELLOW}⚠${NC}  Cannot reach database host ($DB_HOST:$DB_PORT)"
    echo "   Note: This may be expected if running outside production environment"
  fi
  
  echo ""
fi

# Check Redis connectivity (optional)
if [ ! -z "$REDIS_URL" ]; then
  echo "💾 Checking Redis connectivity..."
  
  # Extract host from Redis URL
  redis_host=$(echo "$REDIS_URL" | sed 's|redis://\([^:]*\).*|\1|')
  redis_port=$(echo "$REDIS_URL" | sed 's|.*:\([0-9]*\).*|\1|')
  
  if [ -z "$redis_port" ]; then
    redis_port="6379"
  fi
  
  if timeout 5 bash -c "echo >/dev/tcp/$redis_host/$redis_port" 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Redis reachable ($redis_host:$redis_port)"
  else
    echo -e "${YELLOW}⚠${NC}  Cannot reach Redis ($redis_host:$redis_port)"
    echo "   Note: This may be expected if running outside production environment"
  fi
  
  echo ""
fi

# Check Docker
if command -v docker &> /dev/null; then
  echo "🐳 Checking Docker..."
  docker_version=$(docker --version)
  echo -e "${GREEN}✓${NC} $docker_version"
  
  if command -v docker-compose &> /dev/null; then
    compose_version=$(docker-compose --version)
    echo -e "${GREEN}✓${NC} $compose_version"
  fi
  
  echo ""
fi

# Check git
if command -v git &> /dev/null; then
  echo "📚 Checking Git..."
  git_version=$(git --version)
  echo -e "${GREEN}✓${NC} $git_version"
  
  # Check if .git exists
  if [ -d ".git" ]; then
    echo -e "${GREEN}✓${NC} Git repository initialized"
  fi
  
  echo ""
fi

# Check file structure
echo "📁 Checking directory structure..."

required_dirs=(
  "services/auth-service"
  "services/auth-service/src"
  "apps/gateway"
  "apps/gateway/src"
  "apps/web"
  "apps/web/src"
)

for dir in "${required_dirs[@]}"; do
  if [ -d "$dir" ]; then
    echo -e "${GREEN}✓${NC} $dir"
  else
    echo -e "${RED}✗${NC} $dir (missing)"
    EXIT_CODE=1
  fi
done

echo ""

# Summary
echo "=============================="
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}✓ All checks passed!${NC}"
  echo ""
  echo "🚀 Ready for production deployment"
  echo ""
  echo "Next steps:"
  echo "1. Verify all secrets are securely stored (not committed to git)"
  echo "2. Run database migrations: npm run migrate:prod"
  echo "3. Build Docker images: docker-compose build"
  echo "4. Deploy with: docker-compose -f docker-compose-complete.yml up -d"
  echo "5. Verify health: curl http://localhost:3000/health"
else
  echo -e "${RED}✗ Some checks failed${NC}"
  echo ""
  if [ ${#missing_vars[@]} -gt 0 ]; then
    echo "Missing environment variables:"
    printf '%s\n' "${missing_vars[@]}"
  fi
fi

exit $EXIT_CODE
