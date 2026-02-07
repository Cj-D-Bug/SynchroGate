# Deploying Session Management Changes to Railway

## Summary of Changes
The following files have been added/modified to implement single-device login enforcement:

### New Files:
- `backend/src/services/sessionService.js` - Session management service

### Modified Files:
- `backend/src/controllers/authController.js` - Updated login/logout to handle sessions
- `backend/src/middleware/authMiddleware.js` - Added session validation
- `backend/src/routes/authRoutes.js` - Added logout endpoint
- `backend/src/index.js` - Initialize session listener

## Deployment Steps

### Option 1: Deploy via GitHub (Recommended)

If your Railway project is connected to GitHub:

1. **Initialize Git Repository** (if not already done):
   ```bash
   cd C:\Users\Johnmel\Downloads\SyncroGate
   git init
   git add .
   git commit -m "Add session management: enforce one device per user"
   ```

2. **Connect to GitHub**:
   ```bash
   git remote add origin <your-github-repo-url>
   git branch -M main
   git push -u origin main
   ```

3. **Railway will automatically deploy** when you push to GitHub.

### Option 2: Deploy via Railway CLI

1. **Install Railway CLI**:
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Link to your Railway project**:
   ```bash
   cd backend
   railway link
   ```

4. **Deploy**:
   ```bash
   railway up
   ```

### Option 3: Manual Deployment via Railway Dashboard

1. Go to https://railway.app
2. Select your project
3. Go to your backend service
4. Click "Deploy" or "Redeploy"
5. Railway will rebuild and deploy your latest code

## Verify Deployment

After deployment, check:

1. **Check Railway Logs**:
   - Go to Railway dashboard → Your service → Logs
   - Look for: `✅ User login listener initialized`
   - Look for: `✅ Session created for user...`

2. **Test the API**:
   - Health check: `GET https://your-app.railway.app/`
   - Should return: `{"status": "ok", "message": "GuardianEntry API is running 🚀"}`

3. **Test Session Management**:
   - Try logging in from one device
   - Try logging in from another device
   - The first device should be logged out automatically

## Important Notes

- **No additional environment variables needed** - Session management uses existing Firebase setup
- **Sessions expire after 24 hours** of inactivity
- **Old sessions are automatically cleaned up** every 6 hours
- **Firestore collection**: `user_sessions` will be created automatically

## Troubleshooting

### Session listener not starting
- Check Railway logs for errors
- Verify Firebase connection is working
- Ensure `FIREBASE_SERVICE_ACCOUNT_JSON` is set correctly

### Users can still login from multiple devices
- Check that the session service is initialized (look for log message)
- Verify Firestore permissions allow creating `user_sessions` collection
- Check that `lastLoginAt` is being updated in user documents

### Middleware blocking all requests
- Check that device ID generation is working
- Verify session is being created on login
- Check Railway logs for session validation errors


