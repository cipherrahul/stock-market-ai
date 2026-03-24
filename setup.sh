#!/bin/bash

# Enhanced startup script with better error handling and logging

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀  AI Stock Trading Platform - Complete Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

echo "✅ Docker found"

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

echo "✅ Docker Compose found"

# Load environment variables
if [ ! -f .env ]; then
    echo "📝 Creating .env file from template..."
    cp .env.example .env 2>/dev/null || echo "Note: .env.example not found, using defaults"
fi

echo ""
echo "🔨 Building Docker images..."
docker-compose -f docker-compose-complete.yml build --quiet

if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi

echo "✅ Build completed"

echo ""
echo "📦 Starting services..."
docker-compose -f docker-compose-complete.yml up -d

if [ $? -ne 0 ]; then
    echo "❌ Failed to start services"
    exit 1
fi

echo "✅ Services started"

# Wait for database to be ready
echo ""
echo "⏳ Waiting for PostgreSQL to be ready..."
for i in {1..30}; do
    if docker exec $(docker ps -q -f "name=postgres") pg_isready -U trading_user &>/dev/null; then
        echo "✅ PostgreSQL is ready"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ PostgreSQL failed to start"
        exit 1
    fi
    sleep 2
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Platform Started Successfully!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📱 Access Your Platform:"
echo "   Frontend:        http://localhost:5000"
echo "   API Gateway:     http://localhost:3000"
echo ""
echo "📊 Available Services:"
echo "   Auth Service             → http://localhost:3001"
echo "   User Service             → http://localhost:3002"
echo "   Market Data Service      → http://localhost:3003"
echo "   AI Engine Service        → http://localhost:3004"
echo "   Portfolio Service        → http://localhost:3005"
echo "   Trading Engine Service   → http://localhost:3006"
echo "   Broker Integration       → http://localhost:3007"
echo "   Backtesting Service      → http://localhost:3008"
echo "   Notification Service     → http://localhost:3009"
echo ""
echo "🗄️  Databases:"
echo "   PostgreSQL:  localhost:5432"
echo "   Redis:       localhost:6379"
echo "   Kafka:       localhost:9092"
echo ""
echo "📖 Useful Commands:"
echo "   View logs:              docker-compose -f docker-compose-complete.yml logs -f"
echo "   View specific service:  docker-compose -f docker-compose-complete.yml logs -f <service-name>"
echo "   Stop platform:          docker-compose -f docker-compose-complete.yml down"
echo "   Status check:           docker-compose -f docker-compose-complete.yml ps"
echo ""
echo "🔐 Demo Credentials:"
echo "   Email:    demo@tradepro.com"
echo "   Password: Demo@123456"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
