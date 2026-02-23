# Deploy SyncroGate Backend to Railway

## 1. Push your code to GitHub

Make sure your repo (e.g. `Maomao-2004/Guardientry` or your fork) is up to date.

## 2. Create a Railway project

1. Go to [railway.app](https://railway.app) and sign in (GitHub is fine).
2. Click **New Project** → **Deploy from GitHub repo**.
3. Select your repository (SyncroGate / Guardientry).
4. When asked for the **root directory**, set it to **`backend`** so Railway builds and runs the Node.js API, not the whole repo.

## 3. Configure environment variables

In Railway: open your service → **Variables** tab. Add these (required for the backend to start):

| Variable | Description |
|----------|-------------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Full JSON string of your Firebase service account key (from Firebase Console → Project settings → Service accounts → Generate new key). Paste the entire JSON as one line or use Railway’s “from file” if available. |
| `FIREBASE_DATABASE_URL` | Your Firestore/Realtime DB URL, e.g. `https://guardientry-database.firebaseio.com` or your project’s URL from Firebase Console. |
| `JWT_SECRET` | A long random string used to sign JWTs (e.g. generate with `openssl rand -base64 32`). |

Optional (for production):

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | Set to `production`. |
| `FRONTEND_URL` | Your frontend / Expo app URL for CORS (e.g. `https://your-app.com`). |
| `APP_BASE_URL` | Public URL of this API (e.g. `https://your-backend.up.railway.app`). |
| `TWILIO_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | Only if you use Twilio SMS. |
| `EXPO_PUSH_KEY` | Only if you use Expo push. |

Railway sets **`PORT`** automatically; the app already uses `process.env.PORT`.

## 4. Deploy

- If you used **Deploy from GitHub**, Railway will build and deploy. Every push to the connected branch can trigger a new deploy (you can change this in Settings).
- To deploy from the CLI: install [Railway CLI](https://docs.railway.app/develop/cli), run `railway link` in the `backend` folder, then `railway up`.

## 5. Get the backend URL

In Railway: your service → **Settings** → **Networking** → **Generate domain**. Use this URL in your frontend (e.g. `APP_BASE_URL` or `BASE_URL` in the app).

## Quick checklist

- [ ] Root directory set to **`backend`**
- [ ] `FIREBASE_SERVICE_ACCOUNT_JSON` (full JSON string) set
- [ ] `FIREBASE_DATABASE_URL` set
- [ ] `JWT_SECRET` set
- [ ] Domain generated and URL updated in frontend

After that, the backend is “built” and running on Railway; you don’t need to build it locally for deploy—Railway runs `npm install` and `npm start` in the `backend` folder.
