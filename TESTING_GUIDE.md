# Frontend Testing Guide - Login & Dashboard

## 🎯 Quick Start for Frontend Testing

### Test Credentials
Use these credentials to login and test the frontend **without a database connection**.

```
Email:    demo@tradepro.com
Password: Demo@123456
```

---

## 🚀 Setup Instructions

### Option A: Docker Compose (Complete Stack)

**Prerequisites:**
- Docker Desktop installed and running
- `.env` file created (see below)

**Setup .env file:**

A `.env` file has been created in the root directory with development defaults. You can use it as-is for local testing.

**Start the stack:**
```bash
npm run dev
# or
docker-compose up -d
```

Then wait for all containers to be healthy (~2-3 minutes) and visit:
```
http://localhost:3000/login
```

---

### Option B: Local Development (Recommended for Frontend Testing)

This is **faster** and **simpler** if you just want to test the frontend without a full database setup.

**Prerequisites:**
- Node.js 18+ installed
- No Docker required

**Setup in 3 terminals:**

**Terminal 1 - Auth Service (runs on port 3001):**
```powershell
$env:NODE_ENV='development'
cd services/auth-service
npm install
npm start
```

You should see:
```
✅ Auth Service listening on port 3001

🔧 DEVELOPMENT MODE ENABLED
📝 Test Credentials:
   Email: demo@tradepro.com
   Password: Demo@123456

💡 Use these credentials to test login without a database connection.
```

**Terminal 2 - API Gateway (runs on port 3000):**
```powershell
cd apps/gateway
npm install
npm start
```

**Terminal 3 - Web App:**
```powershell
cd apps/web
npm install
npm run dev
```

**Open browser:**
```
http://localhost:3000
```

---

## 🧪 Testing Login

1. Navigate to **http://localhost:3000/login**
2. Enter the test credentials:
   - Email: `demo@tradepro.com`
   - Password: `Demo@123456`
3. Click **Sign in**
4. You should be redirected to the dashboard ✅

---

## ✨ Features Available After Login

Once logged in, you can test:
- ✅ Dashboard layout and components
- ✅ Navigation and routing
- ✅ UI responsiveness
- ✅ Dark/light mode (if implemented)
- ✅ Mock data visualization

---

## 🔐 Production Mode (With Database)

When you have database credentials:

1. Update `.env` file:
   ```
   NODE_ENV=production
   DB_HOST=your_host
   DB_USER=your_user
   DB_PASSWORD=your_password
   DB_NAME=trading_platform
   ```

2. Seed the database with test user:
   ```bash
   npm run seed
   ```

3. Start services normally:
   ```bash
   npm run dev
   # or
   docker-compose up -d
   ```

---

## 📝 Default Test Database User

If using the database seeding script:
- **Email:** demo@tradepro.com
- **Password:** Demo@123456
- **Name:** Demo User
- **Role:** user

This user is automatically created by the seed script.

---

## 🛠️ Troubleshooting

### "Invalid credentials" error on login
- Make sure you're using exactly:
  - Email: `demo@tradepro.com`
  - Password: `Demo@123456`
- Verify `NODE_ENV=development` is set in auth service

### "Failed to connect to auth service"
- Make sure auth service is running on port 3001
- Check: `http://localhost:3001/health`
- Should return: `{"status":"OK","service":"auth-service","mode":"development","dbAvailable":false}`

### "API Gateway connection failed"
- Make sure API Gateway is running on port 3000
- Verify all 3 services are started

### Docker containers won't start
- Make sure `.env` file exists in root directory
- Try: `docker-compose down && docker-compose up -d`
- Check Docker daemon is running

### Port already in use
- Auth Service (3001): `netstat -ano | findstr :3001`
- Gateway (3000): `netstat -ano | findstr :3000`
- Web (3000): Handled by Next.js, will use 3001 if 3000 is busy

---

## 📚 Additional Resources

- **Auth Service:** `services/auth-service/src/index.ts`
- **Frontend Components:** `apps/web/src/components/`
- **API Gateway:** `apps/gateway/src/`
- **Environment:** `.env` (root directory)

---

## 💡 Development Tips

### Enable Debug Logging
Add to terminal before starting service:
```powershell
$env:LOG_LEVEL='debug'
```

### Test with Multiple Users
1. Register new user at `/register` (in dev mode, not persisted)
2. Or create in database when using production mode

### Check Service Health
```bash
# Auth Service
curl http://localhost:3001/health

# Gateway (once it's running)
curl http://localhost:3000/health
```
