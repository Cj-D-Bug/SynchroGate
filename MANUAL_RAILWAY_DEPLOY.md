# Manual Railway Deployment Commands

## Quick Deploy (Railway CLI - Fastest)

### First Time Setup (one-time):
```powershell
# Install Railway CLI globally
npm install -g @railway/cli

# Login to Railway
railway login

# Navigate to backend directory
cd backend

# Link to your Railway project (select your project when prompted)
railway link
```

### Deploy Updates (run this every time you want to update):
```powershell
# Make sure you're in the backend directory
cd backend

# Deploy to Railway
railway up
```

That's it! Railway will build and deploy your changes.

---

## Method 2: Git Push (Auto-deploy if connected to GitHub)

```powershell
# From project root
cd C:\Users\Johnmel\Downloads\SyncroGate

# Stage all changes
git add .

# Commit changes
git commit -m "fix: handle undefined metadata in sessionService"

# Push to GitHub (Railway will auto-deploy)
git push origin main
```

---

## Method 3: Railway Dashboard (Manual Redeploy)

1. Go to https://railway.app
2. Select your project
3. Click on your backend service
4. Click the **"Redeploy"** button (or go to Settings → Redeploy)

---

## Method 4: Force Rebuild via Railway CLI

If you need to force a clean rebuild:

```powershell
cd backend
railway up --detach
```

Or to see logs in real-time:

```powershell
cd backend
railway up
```

---

## Check Deployment Status

```powershell
# View logs
railway logs

# View service status
railway status
```

---

## Troubleshooting

### If Railway CLI not found:
```powershell
# Install it
npm install -g @railway/cli
```

### If not linked to project:
```powershell
cd backend
railway link
# Select your project from the list
```

### To see what project you're linked to:
```powershell
railway status
```

---

## Quick Reference Card

**Most Common Workflow:**
```powershell
cd backend
railway up
```

**With logs:**
```powershell
cd backend
railway up --follow
```

