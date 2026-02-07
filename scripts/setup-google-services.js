#!/usr/bin/env node
/**
 * Script to setup google-services.json for EAS builds
 * This script writes google-services.json from EAS secret or uses existing file
 */

const fs = require('fs');
const path = require('path');

const GOOGLE_SERVICES_JSON = process.env.GOOGLE_SERVICES_JSON;
const rootDir = path.resolve(__dirname, '..');
const googleServicesPath = path.join(rootDir, 'google-services.json');
const androidAppPath = path.join(rootDir, 'android', 'app', 'google-services.json');
const androidReleasePath = path.join(rootDir, 'android', 'app', 'src', 'release', 'google-services.json');

console.log('📦 Setting up google-services.json for Android build...');

// Function to ensure directory exists
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

// Function to write google-services.json
function writeGoogleServices(content, targetPath) {
  try {
    ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, content, 'utf8');
    console.log(`✅ Created ${path.relative(rootDir, targetPath)}`);
    return true;
  } catch (error) {
    console.error(`❌ Error writing to ${targetPath}:`, error.message);
    return false;
  }
}

// Main logic
if (GOOGLE_SERVICES_JSON) {
  // Use content from EAS secret
  console.log('📝 Using google-services.json from EAS secret...');
  
  // Write to root
  if (!writeGoogleServices(GOOGLE_SERVICES_JSON, googleServicesPath)) {
    process.exit(1);
  }
  
  // Write to android/app
  if (!writeGoogleServices(GOOGLE_SERVICES_JSON, androidAppPath)) {
    process.exit(1);
  }
  
  // Write to android/app/src/release
  if (!writeGoogleServices(GOOGLE_SERVICES_JSON, androidReleasePath)) {
    process.exit(1);
  }
  
  console.log('✅ Successfully set up google-services.json from EAS secret');
} else if (fs.existsSync(googleServicesPath)) {
  // Use existing file from repository
  console.log('📝 Using existing google-services.json from repository...');
  
  const content = fs.readFileSync(googleServicesPath, 'utf8');
  
  // Copy to android/app
  if (!writeGoogleServices(content, androidAppPath)) {
    process.exit(1);
  }
  
  // Copy to android/app/src/release
  if (!writeGoogleServices(content, androidReleasePath)) {
    process.exit(1);
  }
  
  console.log('✅ Successfully copied google-services.json to Android directories');
} else {
  // Create a minimal placeholder for prebuild to succeed
  // The pre-build hook will replace it with the real one if available
  console.warn('⚠️  google-services.json not found and GOOGLE_SERVICES_JSON secret not set');
  console.warn('📝 Creating placeholder google-services.json for prebuild (will be replaced by pre-build hook)');
  
  const placeholderContent = JSON.stringify({
    project_info: {
      project_number: "000000000000",
      project_id: "placeholder",
      storage_bucket: "placeholder.appspot.com"
    },
    client: [{
      client_info: {
        mobilesdk_app_id: "1:000000000000:android:placeholder",
        android_client_info: {
          package_name: "com.palabay.synchrogate"
        }
      },
      oauth_client: [],
      api_key: [{
        current_key: "placeholder"
      }],
      services: {
        appinvite_service: {
          other_platform_oauth_client: []
        }
      }
    }],
    configuration_version: "1"
  }, null, 2);
  
  // Create placeholder in root
  if (!writeGoogleServices(placeholderContent, googleServicesPath)) {
    console.error('❌ Failed to create placeholder google-services.json');
    process.exit(1);
  }
  
  console.warn('⚠️  Using placeholder google-services.json - Firebase features may not work until real file is provided');
  console.warn('💡 To fix: Set GOOGLE_SERVICES_JSON as an EAS secret or commit google-services.json to repository');
}

console.log('✅ Google Services setup complete!');












































































































