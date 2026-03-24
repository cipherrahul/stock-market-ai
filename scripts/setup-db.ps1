#!/usr/bin/env pwsh
# Database Setup Script for Windows
# This script will set up PostgreSQL and initialize the trading platform database

Write-Host "🔧 Trading Platform Database Setup" -ForegroundColor Cyan
Write-Host "===================================" -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL is installed
Write-Host "📋 Checking PostgreSQL installation..." -ForegroundColor Yellow
$pgStatusCmd = psql --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ PostgreSQL is not installed or not in PATH" -ForegroundColor Red
    Write-Host "📥 Please install PostgreSQL from: https://www.postgresql.org/download/windows/" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After installation:" -ForegroundColor Yellow
    Write-Host "1. Add PostgreSQL bin folder to PATH (usually C:\Program Files\PostgreSQL\15\bin)" -ForegroundColor White
    Write-Host "2. Run this script again" -ForegroundColor White
    exit 1
}
Write-Host "✅ PostgreSQL found: $pgStatusCmd" -ForegroundColor Green
Write-Host ""

# Database credentials
$dbUser = "trading_user"
$dbPassword = "trading_password_123"
$dbName = "trading_platform_dev"
$pgUser = "postgres"
$pgHost = "localhost"

Write-Host "🛠️  Database Configuration:" -ForegroundColor Cyan
Write-Host "  Host: $pgHost" -ForegroundColor White
Write-Host "  Database: $dbName" -ForegroundColor White
Write-Host "  User: $dbUser" -ForegroundColor White
Write-Host ""

# Prompt for postgres password
Write-Host "🔐 Enter PostgreSQL 'postgres' user password (or press Enter if empty): " -ForegroundColor Yellow -NoNewline
$securePassword = Read-Host -AsSecureString
$postgresPassword = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto([System.Runtime.InteropServices.Marshal]::SecureStringToCoTaskMemUnicodePtr($securePassword))

Write-Host ""
Write-Host "📦 Creating database role and database..." -ForegroundColor Yellow

# Step 1: Create trading_user role
$env:PGPASSWORD = $postgresPassword
psql -h $pgHost -U $pgUser -d postgres -c "CREATE ROLE $dbUser WITH LOGIN PASSWORD '$dbPassword';" 2>&1 | grep -v "already exists"
$env:PGPASSWORD = ""

# Step 2: Create database
$env:PGPASSWORD = $postgresPassword
psql -h $pgHost -U $pgUser -d postgres -c "CREATE DATABASE $dbName OWNER $dbUser;" 2>&1 | grep -v "already exists"
$env:PGPASSWORD = ""

Write-Host "✅ Database initialization completed" -ForegroundColor Green
Write-Host ""

# Step 3: Run schema and seed
Write-Host "📊 Running database schema setup..." -ForegroundColor Yellow

$schemaFile = ".\infra\database\schema.sql"
if (Test-Path $schemaFile) {
    $env:PGPASSWORD = $dbPassword
    psql -h $pgHost -U $dbUser -d $dbName -f $schemaFile
    $env:PGPASSWORD = ""
    Write-Host "✅ Schema applied successfully" -ForegroundColor Green
} else {
    Write-Host "⚠️  Schema file not found at $schemaFile" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🌱 Running database seed..." -ForegroundColor Yellow
Write-Host "ℹ️  Run: npm run seed (from project root)" -ForegroundColor Cyan
Write-Host ""

Write-Host "✨ Database setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Update .env files with these credentials (already configured in .env.local)" -ForegroundColor White
Write-Host "2. Run 'npm run seed' to add test data" -ForegroundColor White
Write-Host "3. Start services with 'npm start' in each service directory" -ForegroundColor White
Write-Host ""
