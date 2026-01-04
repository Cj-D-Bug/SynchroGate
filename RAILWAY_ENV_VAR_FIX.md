# 🚨 CRITICAL: Railway Environment Variables Not Working

## The Problem
Railway is **NOT passing environment variables** to your container. The debug logs show:
- `🔍 All env vars starting with FIREBASE: []` (empty array)
- No environment variables are being passed at all

## ✅ SOLUTION: Follow These Steps EXACTLY

### Step 1: Verify You're on the SERVICE (Not Project)
1. Go to https://railway.app
2. Click your **PROJECT** name
3. You should see a list of **SERVICES** (boxes/cards)
4. **Click on the SERVICE** that runs your backend (not the project itself)
5. The URL should look like: `https://railway.app/project/[project-id]/service/[service-id]`

### Step 2: Check Variables Tab
1. While **INSIDE the service** (not project)
2. Click **"Variables"** in the left sidebar
3. You should see a table/list of variables

### Step 3: Delete ALL Existing Variables
1. If you see any variables, **DELETE them all** (click the trash icon)
2. This ensures we start fresh

### Step 4: Add Variables ONE BY ONE
Add each variable **separately** and click **"Add"** after each one:

#### Variable 1: FIREBASE_SERVICE_ACCOUNT_JSON
- **Name:** `FIREBASE_SERVICE_ACCOUNT_JSON`
- **Value:** (paste the complete JSON string from your `backend/guardientry-database-firebase-adminsdk-fbsvc-82f126dd57.json` file, all on one line)
- **How to get it:** Run this command locally:
  ```bash
  cd backend
  node -e "const fs = require('fs'); const json = JSON.parse(fs.readFileSync('guardientry-database-firebase-adminsdk-fbsvc-82f126dd57.json', 'utf8')); console.log(JSON.stringify(json));"
  ```
  Copy the entire output (it's all one line) and paste it as the value.

#### Variable 2: FIREBASE_DATABASE_URL
- **Name:** `FIREBASE_DATABASE_URL`
- **Value:** `https://guardientry-database-default-rtdb.firebaseio.com`

#### Variable 3: JWT_SECRET
- **Name:** `JWT_SECRET`
- **Value:** `W+hS+CGYMwXAo/u0eBzo57QmJZja3M56PKesM0HzhEg=`

### Step 5: Verify Variables Are Saved
1. After adding all 3, refresh the page
2. Go back to **Variables** tab
3. You should see all 3 variables listed
4. **Double-check the names** - they must be EXACTLY:
   - `FIREBASE_SERVICE_ACCOUNT_JSON` (all caps, underscores)
   - `FIREBASE_DATABASE_URL` (all caps, underscores)
   - `JWT_SECRET` (all caps, underscore)

### Step 6: Force Redeploy
1. Go to **"Deployments"** tab
2. Click the **three dots** (⋯) on the latest deployment
3. Click **"Redeploy"**
4. Wait for deployment to complete (2-3 minutes)

### Step 7: Check Logs
After redeploy, check **Runtime Logs**. You should see:
```
🔍 Total env vars: [some number > 0]
🔍 All env var names: [list of variables]
🔍 Available env vars (FIREBASE/JWT): FIREBASE_SERVICE_ACCOUNT_JSON, FIREBASE_DATABASE_URL, JWT_SECRET
🔍 FIREBASE_SERVICE_ACCOUNT_JSON exists: true
🔍 FIREBASE_SERVICE_ACCOUNT_JSON length: [some number > 1000]
```

## If Still Not Working

### Check 1: Multiple Services
- Do you have multiple services in your project?
- Make sure variables are on the **backend service**, not a frontend or other service

### Check 2: Railway CLI (Alternative)
If dashboard doesn't work, try Railway CLI:
```bash
railway variables set FIREBASE_SERVICE_ACCOUNT_JSON="[value]" --service [your-service-name]
```

### Check 3: Contact Railway Support
If variables still don't appear, this might be a Railway platform issue. Contact Railway support.

## Common Mistakes

❌ **Setting variables at Project level** → Variables won't be passed to containers
✅ **Setting variables at Service level** → Variables will be passed

❌ **Not redeploying after adding variables** → Old container still running
✅ **Redeploy after adding variables** → New container gets variables

❌ **Variable name typos** → `firebase_service_account_json` (wrong)
✅ **Exact variable names** → `FIREBASE_SERVICE_ACCOUNT_JSON` (correct)
