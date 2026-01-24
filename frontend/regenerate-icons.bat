@echo off
REM Script to regenerate app icons from app.json
REM This will delete old native icon files and regenerate them

echo 🔄 Regenerating app icons from app.json...

REM Delete Android native icon resources
echo 📱 Cleaning Android icon resources...
if exist "android\app\src\main\res\mipmap-hdpi" rmdir /s /q "android\app\src\main\res\mipmap-hdpi"
if exist "android\app\src\main\res\mipmap-mdpi" rmdir /s /q "android\app\src\main\res\mipmap-mdpi"
if exist "android\app\src\main\res\mipmap-xhdpi" rmdir /s /q "android\app\src\main\res\mipmap-xhdpi"
if exist "android\app\src\main\res\mipmap-xxhdpi" rmdir /s /q "android\app\src\main\res\mipmap-xxhdpi"
if exist "android\app\src\main\res\mipmap-xxxhdpi" rmdir /s /q "android\app\src\main\res\mipmap-xxxhdpi"
if exist "android\app\src\main\res\mipmap-anydpi-v26" rmdir /s /q "android\app\src\main\res\mipmap-anydpi-v26"

REM Delete splash screen logos
for /d %%d in (android\app\src\main\res\drawable-*) do (
    if exist "%%d\splashscreen_logo.png" del /q "%%d\splashscreen_logo.png"
)

REM Delete iOS native icon resources (if they exist)
if exist "ios" (
    echo 🍎 Cleaning iOS icon resources...
    if exist "ios\*\Images.xcassets\AppIcon.appiconset" rmdir /s /q "ios\*\Images.xcassets\AppIcon.appiconset"
)

REM Regenerate native code with new icons
echo 🔨 Running expo prebuild to regenerate icons...
call npx expo prebuild --clean

echo ✅ Icon regeneration complete!
echo 📝 Next steps:
echo    1. Build your app with: npm run build:android or eas build --platform android
echo    2. The new SG.png icon will be used in the app

pause





