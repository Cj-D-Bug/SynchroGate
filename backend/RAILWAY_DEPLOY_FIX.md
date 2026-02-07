# Fix Railway Deployment - Session Management Update

## Issue
Railway did not automatically detect and build the session management changes.

## Solution Steps

### Step 1: Push Changes to GitHub (if not already done)
```powershell
# Check if you have a remote configured
git remote -v

# If no remote, add your GitHub repo:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git branch -M main
git push -u origin main

# If remote exists, just push:
git push
```

### Step 2: Configure Railway Service Settings

1. **Go to Railway Dashboard**: https://railway.app
2. **Select your project** → **Select your backend service**
3. **Go to Settings tab**
4. **Check the following settings**:

   **Root Directory:**
   - Should be set to `backend` (not root `/`)
   - If it's set to `/`, change it to `backend`
   
   **Build Command:**
   - Should be: `npm install` (or leave empty for auto-detection)
   
   **Start Command:**
   - Should be: `npm start` (or leave empty for auto-detection)

### Step 3: Trigger Manual Redeploy

**Option A - Via Railway Dashboard:**
1. Go to your backend service in Railway
2. Click on the **"Deployments"** tab
3. Click **"Redeploy"** button on the latest deployment
4. Or click **"Deploy"** → **"Deploy Latest Commit"**

**Option B - Via Railway CLI:**
```powershell
# Install Railway CLI if not installed
npm install -g @railway/cli

# Login
railway login

# Link to your project (if not already linked)
cd backend
railway link

# Trigger redeploy
railway up
```

**Option C - Push an empty commit to trigger rebuild:**
```powershell
git commit --allow-empty -m "Trigger Railway rebuild"
git push
```

### Step 4: Verify Deployment

1. **Check Railway Logs:**
   - Go to Railway Dashboard → Your service → Logs
   - Look for: `✅ User login listener initialized`
   - Look for: `✅ Session created for user...`

2. **Check Build Logs:**
   - Look for successful npm install
   - Look for successful build completion
   - Check for any errors

3. **Test the API:**
   - Health check: `GET https://your-app.railway.app/`
   - Should return: `{"status": "ok", "message": "GuardianEntry API is running 🚀"}`

## Common Issues

### Issue: Railway not detecting changes
**Solution:** 
- Ensure Root Directory is set to `backend` in Railway settings
- Check that you pushed to the correct branch (usually `main` or `master`)
- Verify GitHub integration is connected in Railway

### Issue: Build fails
**Solution:**
- Check Railway build logs for errors
- Verify `package.json` is in the `backend` directory
- Ensure all dependencies are listed in `package.json`
- Check that `nixpacks.toml` or `Procfile` exists in `backend` directory

### Issue: Service won't start
**Solution:**
- Check Railway logs for startup errors
- Verify `PORT` environment variable is set (Railway sets this automatically)
- Check that `npm start` command works locally
- Verify Firebase environment variables are set correctly

## Files Added/Modified for Session Management

✅ `backend/src/services/sessionService.js` (NEW)
✅ `backend/src/controllers/authController.js` (MODIFIED)
✅ `backend/src/middleware/authMiddleware.js` (MODIFIED)
✅ `backend/src/routes/authRoutes.js` (MODIFIED)
✅ `backend/src/index.js` (MODIFIED)
✅ `backend/railway.json` (NEW - ensures Railway builds from backend directory)

## Next Steps After Deployment

1. **Monitor logs** for the first few minutes after deployment
2. **Test login** from one device
3. **Test login** from another device - first device should be logged out
4. **Verify session cleanup** is working (check logs after 6 hours)

