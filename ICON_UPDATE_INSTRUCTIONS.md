# Icon Update Instructions

## Problem
The old icon still appears after downloading the app because Android native icon files are cached.

## Solution

### Option 1: Regenerate Icons (Recommended)
Run this command in the `frontend` directory:

```bash
npm run regenerate-icons
```

Or manually:
```bash
npx expo prebuild --clean
```

This will regenerate all native icon files from `app.json` using the new `SG.png` icon.

### Option 2: Clean Build with EAS
When building with EAS, the icons should regenerate automatically. To ensure a clean build:

```bash
# Clear EAS build cache (if needed)
eas build --platform android --profile production --clear-cache

# Or just rebuild
eas build --platform android --profile production
```

### Option 3: Manual Clean (if scripts don't work)
1. Delete these directories manually:
   - `android/app/src/main/res/mipmap-*` (all mipmap directories)
   - `android/app/src/main/res/drawable-*/splashscreen_logo.png` (splash logos)

2. Then run:
   ```bash
   npx expo prebuild --clean
   ```

## Verification
After regenerating, check that:
- ✅ `app.json` has `"icon": "./src/assets/SG.png"`
- ✅ `app.json` has `"splash.image": "./src/assets/SG.png"`
- ✅ `app.json` has `"android.adaptiveIcon.foregroundImage": "./src/assets/SG.png"`
- ✅ `app.json` has `"web.favicon": "./src/assets/SG.png"`

## Important Notes
- **Native icon files are auto-generated** from `app.json` during build
- **EAS builds** will regenerate icons automatically if you use `--clear-cache`
- **Local builds** require running `expo prebuild --clean` after deleting old icons
- The icon files in `android/app/src/main/res/mipmap-*` are generated files and will be recreated

## After Regeneration
1. Build your app: `npm run build:android` or `eas build --platform android`
2. Install the new APK/AAB
3. The new SG.png icon should now appear!















