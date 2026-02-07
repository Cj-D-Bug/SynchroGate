# Quick Start - Railway Deployment

## ✅ What's Been Set Up

1. **Railway Configuration Files**
   - `railway.json` - Railway deployment config
   - `Procfile` - Process file for Railway
   - Module system fixed (all CommonJS now)

2. **Push Notifications Ready**
   - `pushService.js` - Expo Push API integration
   - `notificationController.js` - Complete notification handlers
   - Routes configured at `/api/notifications`

## 🚀 Deploy to Railway

### Step 1: Connect to Railway
1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `SyncroGate` repository
4. **IMPORTANT**: In Railway project settings:
   - Go to your service → Settings
   - Under "Root Directory", set it to `backend`
   - OR use the root directory and Railway will use the config files we created

### Step 2: Set Environment Variables
In Railway dashboard → Variables, add these:

```
# Server
PORT=8000
NODE_ENV=production

# Firebase (REQUIRED)
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com

# JWT (REQUIRED)
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d

# App URLs
APP_BASE_URL=https://your-app.railway.app
FRONTEND_URL=https://your-frontend-url.com
```

### Step 3: Deploy
Railway will automatically:
- Run `npm install`
- Run `npm start`
- Your API will be live!

## 📱 Testing Push Notifications

### Endpoint: `POST /api/notifications/push`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
```

**Body:**
```json
{
  "tokens": ["ExponentPushToken[xxxxxxxxxxxxx]"],
  "title": "Test Notification",
  "body": "This is a test push notification"
}
```

**Response:**
```json
{
  "message": "Push notification sent successfully."
}
```

## 🔍 Verify Deployment

1. Check health: `GET https://your-app.railway.app/`
   - Should return: `{"message": "GuardianEntry API is running 🚀"}`

2. Check logs in Railway dashboard
3. Test push notification endpoint

## 📝 Notes

- Railway automatically provides `PORT` environment variable
- Your app listens on `0.0.0.0` which is correct for Railway
- Push notifications use Expo Push API (no additional setup needed)
- All module system issues have been fixed

## 🐛 Troubleshooting

**Server won't start:**
- Check Railway logs
- Verify `FIREBASE_SERVICE_ACCOUNT_JSON` is valid JSON string
- Ensure all required env vars are set

**Push notifications fail:**
- Verify Expo push tokens are valid
- Check notification controller logs
- Ensure Firebase is properly configured

