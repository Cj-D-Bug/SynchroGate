#!/bin/bash
# EAS Build Hook: Setup google-services.json from secret or file
# This hook runs BEFORE prebuild, ensuring google-services.json exists

set -e

echo "📦 Setting up google-services.json for Android build..."

# Run the Node.js setup script which handles all the logic
node scripts/setup-google-services.js

# The script will create the file if needed, so we just verify it exists
if [ -f "google-services.json" ]; then
  echo "✅ google-services.json is ready for prebuild"
else
  echo "❌ Failed to create google-services.json"
  exit 1
fi












































































































