const fs = require('fs');
const path = require('path');

// Read the existing app.json
const appJson = require('./app.json');

// Setup google-services.json from EAS secret if provided
const GOOGLE_SERVICES_JSON = process.env.GOOGLE_SERVICES_JSON;
const googleServicesPath = path.join(__dirname, 'google-services.json');

// Only write from EAS secret if the secret is valid and file doesn't exist
if (GOOGLE_SERVICES_JSON && 
    GOOGLE_SERVICES_JSON !== '@GOOGLE_SERVICES_JSON' && 
    GOOGLE_SERVICES_JSON.trim().length > 0 &&
    !fs.existsSync(googleServicesPath)) {
  try {
    // Validate JSON
    const parsed = JSON.parse(GOOGLE_SERVICES_JSON);
    fs.writeFileSync(googleServicesPath, JSON.stringify(parsed, null, 2), 'utf8');
    console.log('✅ Created google-services.json from EAS secret');
  } catch (error) {
    console.warn('⚠️  Failed to parse GOOGLE_SERVICES_JSON secret:', error.message);
  }
}

// Verify google-services.json exists
if (fs.existsSync(googleServicesPath)) {
  console.log('✅ google-services.json found at project root');
} else {
  console.warn('⚠️  google-services.json not found - will be created by pre-build hook or plugin');
  // Create a minimal placeholder if it doesn't exist (for prebuild to succeed)
  // The pre-build hook will replace it with the real one
  const minimalGoogleServices = {
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
  };
  
  try {
    fs.writeFileSync(googleServicesPath, JSON.stringify(minimalGoogleServices, null, 2));
    console.log('✅ Created placeholder google-services.json (will be replaced by pre-build hook)');
  } catch (error) {
    console.warn('⚠️  Could not create placeholder google-services.json:', error.message);
  }
}

module.exports = appJson;
