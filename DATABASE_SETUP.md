# Quick Database Setup Guide

## Option 1: Using Docker Compose (Recommended for Development)

If you have Docker installed, this is the easiest method:

```bash
# Start PostgreSQL in Docker
docker-compose -f docker-compose.yml up -d postgres

# Or use the provided compose file
docker-compose up -d

# Verify it's running
docker ps | grep postgres
```

The database will be accessible at:
- Host: localhost
- Port: 5432
- User: trading_user
- Password: trading_password_123

## Option 2: Local PostgreSQL Installation

### Windows Installation

1. **Download PostgreSQL**
   - Go to: https://www.postgresql.org/download/windows/
   - Download PostgreSQL 15 or later
   - Run the installer

2. **Installation Steps**
   - Choose installation directory (or accept default)
   - Select components (keep PostgreSQL Server checked)
   - Set password for 'postgres' user (write it down!)
   - Set port: 5432 (default)
   - Select locale: [your locale]
   - Complete installation

3. **Add PostgreSQL to PATH**
   - Windows 10/11: Settings > System > System Settings > Advanced system settings
   - Click "Environment Variables"
   - Add: `C:\Program Files\PostgreSQL\15\bin` to PATH
   - Restart your terminal

4. **Verify Installation**
   ```bash
   psql --version
   ```

### Initialize Database

Once PostgreSQL is running:

```bash
# Method 1: Using provided setup script
node scripts/setup-db.js

# Method 2: Manual setup with psql
psql -U postgres
# Then in psql:
# CREATE ROLE trading_user WITH LOGIN PASSWORD 'trading_password_123';
# CREATE DATABASE trading_platform_dev OWNER trading_user;
# \q

# Apply schema
psql -U trading_user -d trading_platform_dev -h localhost -f infra/database/schema.sql

# Seed test data
npm run seed
```

## Verifying Database Setup

```bash
# Connect to the database
psql -U trading_user -d trading_platform_dev -h localhost

# Check tables
\dt

# Verify sample user was created
SELECT email, name FROM users;

# Exit
\q
```

## Environment Variables

All .env.local files are pre-configured with:
- DB_HOST=localhost
- DB_PORT=5432
- DB_USER=trading_user
- DB_PASSWORD=trading_password_123
- DB_NAME=trading_platform_dev

No changes needed unless you configured PostgreSQL differently.

## Troubleshooting

### "connection refused"
- PostgreSQL is not running
- Windows: Check Services > PostgreSQL and start it
- Docker: Run `docker-compose up -d postgres`

### "role trading_user does not exist"
- Run the setup script again: `node scripts/setup-db.js`
- Or create manually: connect as `postgres` and create the role

### "EACCES: permission denied"
- On Linux/Mac: Use `sudo` if needed
- Check PostgreSQL is running with correct permissions

### Port 5432 already in use
- Another instance of PostgreSQL might be running
- Windows: Check Services or run `netstat -ano | findstr :5432`
- Docker: Make sure only one postgres container is running

## Next Steps

Once database is set up:
1. Verify: `psql -U trading_user -d trading_platform_dev -c "SELECT COUNT(*) FROM users;"`
2. Run services: `npm start` in each service directory
3. Test API: See END-TO-END TEST section
