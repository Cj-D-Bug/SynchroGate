const { withAndroidManifest } = require('@expo/config-plugins');

/**
 * Fix manifest merger conflict between expo-notifications and @react-native-firebase/messaging
 * Both try to set com.google.firebase.messaging.default_notification_color
 */
const withFixManifestMerger = (config) => {
  return withAndroidManifest(config, async (config) => {
    const androidManifest = config.modResults;
    const mainApplication = androidManifest.manifest.application[0];

    // Find and fix the notification color meta-data
    if (mainApplication['meta-data']) {
      mainApplication['meta-data'] = mainApplication['meta-data'].map((metaData) => {
        if (
          metaData.$['android:name'] === 'com.google.firebase.messaging.default_notification_color'
        ) {
          // Add tools:replace to fix the conflict
          metaData.$['tools:replace'] = 'android:resource';
        }
        return metaData;
      });
    }

    // Ensure tools namespace is declared
    if (!androidManifest.manifest.$['xmlns:tools']) {
      androidManifest.manifest.$['xmlns:tools'] = 'http://schemas.android.com/tools';
    }

    return config;
  });
};

module.exports = withFixManifestMerger;

