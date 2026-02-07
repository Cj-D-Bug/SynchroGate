const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Custom plugin to make google-services.json optional during prebuild
 * This prevents build failures when the file doesn't exist yet (it will be created by pre-build hook)
 */
const withGoogleServicesOptional = (config) => {
  return withDangerousMod(config, [
    'android',
    async (config) => {
      const googleServicesPath = path.join(config.modRequest.platformProjectRoot, 'app', 'google-services.json');
      const rootGoogleServicesPath = path.join(config.modRequest.projectRoot, 'google-services.json');
      
      // If google-services.json doesn't exist in root, create a minimal valid one
      if (!fs.existsSync(rootGoogleServicesPath)) {
        console.log('⚠️  google-services.json not found - creating minimal placeholder');
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
                package_name: config.android?.package || "com.palabay.synchrogate"
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
        
        fs.writeFileSync(rootGoogleServicesPath, JSON.stringify(minimalGoogleServices, null, 2));
        console.log('✅ Created placeholder google-services.json (will be replaced by pre-build hook)');
      }
      
      return config;
    },
  ]);
};

module.exports = withGoogleServicesOptional;

