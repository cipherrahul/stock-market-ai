@echo off
REM Trading Platform Complete Startup Script

echo 🚀 Starting Trading Platform...
echo.
echo Building images...
docker-compose -f docker-compose-complete.yml build

echo.
echo Starting services...
docker-compose -f docker-compose-complete.yml up -d

echo.
echo ✅ All services are starting...
echo.
echo Services:
echo   API Gateway: http://localhost:3000
echo   Frontend: http://localhost:5000
echo   Auth Service: http://localhost:3001
echo   User Service: http://localhost:3002
echo   Market Data Service: http://localhost:3003
echo   AI Engine Service: http://localhost:3004
echo   Portfolio Service: http://localhost:3005
echo   Trading Engine Service: http://localhost:3006
echo   Broker Integration Service: http://localhost:3007
echo   Backtesting Service: http://localhost:3008
echo   Notification Service: http://localhost:3009
echo.
echo Databases:
echo   PostgreSQL: localhost:5432
echo   Redis: localhost:6379
echo   Kafka: localhost:9092
echo.
echo Check status: docker-compose -f docker-compose-complete.yml ps
echo View logs: docker-compose -f docker-compose-complete.yml logs -f
echo Stop all: docker-compose -f docker-compose-complete.yml down
