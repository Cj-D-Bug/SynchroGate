// pushService.js - Send push notifications using Firebase Cloud Messaging (FCM)
const { admin } = require('../config/firebase');

/**
 * Send push notification using FCM
 * @param {string} fcmToken - FCM token from the device
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload
 * @returns {Promise<object>} FCM response
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  try {
    // Validate FCM token
    if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim().length === 0) {
      throw new Error('Invalid FCM token provided');
    }
    
    // FCM tokens are typically 152–163 chars; allow a wider range for compatibility
    if (fcmToken.length < 80 || fcmToken.length > 300) {
      throw new Error('FCM token length is invalid');
    }

    // FCM data payload: every value must be a string; omit undefined/null
    const dataPayload = {
      title: String(title || 'Notification'),
      body: String(body || ''),
    };
    Object.keys(data || {}).forEach((key) => {
      const v = data[key];
      if (v !== undefined && v !== null) {
        dataPayload[key] = String(v);
      }
    });

    // Build FCM message
    // CRITICAL: When app is closed, FCM automatically displays notifications
    // if both 'notification' and 'data' fields are present
    const message = {
      token: fcmToken,
      // Notification payload - automatically displayed by FCM when app is closed
      notification: {
        title: title || 'Notification',
        body: body || '',
        imageUrl: data?.imageUrl ? String(data.imageUrl) : undefined,
      },
      // Data payload - all string values (FCM requirement)
      data: dataPayload,
      android: {
        // CRITICAL: 'high' priority ensures notification is delivered even when app is closed
        priority: 'high',
        notification: {
          channelId: 'default', // Must match the channel created in the app
          sound: 'default',
          priority: 'high', // High priority for heads-up notification
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public', // Show notification even when device is locked
          notificationCount: 1, // Badge count
          // Don't set clickAction - let FCM handle it automatically
          // Ensure notification shows even when screen is off
          lightSettings: {
            color: '#0000FF', // Blue color in hex format (#RRGGBB)
            lightOnDurationMillis: 1000, // 1 second in milliseconds
            lightOffDurationMillis: 1000, // 1 second in milliseconds
          },
        },
        // Critical: These settings ensure notifications work when app is closed
        ttl: 86400000, // 24 hours - how long notification is valid
        // Use unique collapse key per alert to prevent collapsing different alerts
        collapseKey: (data && data.alertId) ? String(data.alertId) : `alert_${Date.now()}`,
        // Direct boot mode - deliver notification even after reboot
        directBootOk: true,
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            // Ensure notification is delivered even when app is closed
            contentAvailable: true,
          },
        },
      },
      // Web push configuration (if needed)
      webpush: {
        notification: {
          title: title || 'Notification',
          body: body || '',
          icon: '/icon.png',
        },
      },
    };

    // Send via Firebase Admin SDK (requires Cloud Messaging API enabled in Google Cloud Console)
    const response = await admin.messaging().send(message);
    
    console.log('✅ FCM push notification sent successfully:', response);
    return {
      success: true,
      messageId: response,
      token: fcmToken,
    };
  } catch (err) {
    const msg = err?.message || String(err);
    console.error('❌ FCM push notification failed:', msg);
    if (/permission|403|not enabled|API has not been used/i.test(msg)) {
      console.error('   Enable "Firebase Cloud Messaging API" in Google Cloud Console → APIs & Services for your project.');
    }
    throw err;
  }
};

/**
 * Send push notification to multiple tokens
 * @param {string[]} fcmTokens - Array of FCM tokens
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload
 * @returns {Promise<object>} Batch response
 */
const sendPushNotificationToMultiple = async (fcmTokens, title, body, data = {}) => {
  try {
    if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) {
      throw new Error('Invalid FCM tokens array');
    }

    // FCM data payload: every value must be a string
    const dataPayload = { title: String(title || 'Notification'), body: String(body || '') };
    Object.keys(data || {}).forEach((key) => {
      const v = data[key];
      if (v !== undefined && v !== null) dataPayload[key] = String(v);
    });

    // Build multicast message
    const message = {
      notification: {
        title: title || 'Notification',
        body: body || '',
      },
      data: dataPayload,
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
          priority: 'high',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
      tokens: fcmTokens,
    };

    // Send via Firebase Admin SDK (multicast)
    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(`✅ FCM multicast sent: ${response.successCount} successful, ${response.failureCount} failed`);
    
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      responses: response.responses,
    };
  } catch (err) {
    console.error('❌ FCM multicast failed:', err);
    throw new Error(`Failed to send multicast push notification: ${err.message}`);
  }
};

// Alias for backward compatibility
const sendPush = sendPushNotification;

module.exports = { 
  sendPushNotification, 
  sendPush,
  sendPushNotificationToMultiple 
};
