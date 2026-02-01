# Android Launcher Icon Fix

## Problem

The Android build is failing with the error:
```
ERROR: resource mipmap/ic_launcher (aka com.palabay.synchrogate:mipmap/ic_launcher) not found.
ERROR: resource mipmap/ic_launcher_round (aka com.palabay.synchrogate:mipmap/ic_launcher_round) not found.
```

This happens because the required launcher icon PNG files are missing from the `android/app/src/main/res/mipmap-*` directories.

## Solution

You have two options to fix this:

### Option 1: Use Expo Prebuild (Recommended)

Run the existing regenerate-icons script:
```bash
npm run regenerate-icons
```

This will regenerate all native code including icons from your `app.json` configuration.

### Option 2: Generate Icons Manually

1. Install the required dependency:
   ```bash
   npm install --save-dev sharp
   ```

2. Run the icon generation script:
   ```bash
   npm run generate-android-icons
   ```

This will generate all required icon sizes from `src/assets/SG.png` into the appropriate mipmap directories.

## What Was Fixed

- Created `mipmap-anydpi-v26` directories with adaptive icon XML files (for Android 8.0+)
- Created `ic_launcher_foreground.xml` drawable resource
- Added script to generate PNG icons for all density buckets

## Note

The adaptive icons (`mipmap-anydpi-v26`) are already created and will work for Android 8.0+. However, Android still requires PNG files in the base mipmap directories for older Android versions and as fallbacks.














