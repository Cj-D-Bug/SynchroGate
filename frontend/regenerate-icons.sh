#!/bin/bash

# Script to regenerate app icons from app.json
# This will delete old native icon files and regenerate them

echo "🔄 Regenerating app icons from app.json..."

# Delete Android native icon resources
echo "📱 Cleaning Android icon resources..."
rm -rf android/app/src/main/res/mipmap-*
rm -rf android/app/src/main/res/drawable-*/splashscreen_logo.png

# Delete iOS native icon resources (if they exist)
if [ -d "ios" ]; then
    echo "🍎 Cleaning iOS icon resources..."
    rm -rf ios/*/Images.xcassets/AppIcon.appiconset/*
fi

# Regenerate native code with new icons
echo "🔨 Running expo prebuild to regenerate icons..."
npx expo prebuild --clean

echo "✅ Icon regeneration complete!"
echo "📝 Next steps:"
echo "   1. Build your app with: npm run build:android or eas build --platform android"
echo "   2. The new SG.png icon will be used in the app"





