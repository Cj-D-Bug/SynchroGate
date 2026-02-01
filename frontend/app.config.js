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
  console.warn('⚠️  google-services.json not found - Firebase may not work');
}

module.exports = appJson;
