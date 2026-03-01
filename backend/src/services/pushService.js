// pushService.js - Send push notifications using Firebase Cloud Messaging (FCM)
// Works with Railway backend and Expo/React Native FCM tokens
const { admin } = require('../config/firebase');

/**
 * Send push notification using FCM
 * @param {string} fcmToken - FCM token from the device (or Expo push token)
 * @param {string} title - Notification title
 * @param {string} body - Notification body
 * @param {object} data - Additional data payload (values will be stringified for FCM)
 * @returns {Promise<object>} FCM response
 */
const sendPushNotification = async (fcmToken, title, body, data = {}) => {
  try {
    if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim().length === 0) {
      throw new Error('Invalid FCM token provided');
    }
    const token = fcmToken.trim();
    // Allow typical FCM length and Expo tokens (e.g. ExponentPushToken[...])
    if (token.length < 20 || token.length > 500) {
      throw new Error('FCM token length is invalid');
    }

    const message = {
      token,
      notification: {
        title: title || 'Notification',
        body: body || '',
        imageUrl: data.imageUrl || undefined,
      },
      data: {
        ...Object.keys(data).reduce((acc, key) => {
          acc[key] = String(data[key] ?? '');
          return acc;
        }, {}),
        title: String(title || 'Notification'),
        body: String(body || ''),
      },
      android: {
        priority: 'high',
        notification: {
          channelId: 'default',
          sound: 'default',
          priority: 'high',
          defaultSound: true,
          defaultVibrateTimings: true,
          visibility: 'public',
          notificationCount: 1,
        },
        ttl: 86400000,
        collapseKey: data.alertId || `alert_${Date.now()}`,
        directBootOk: true,
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('✅ FCM push sent:', response);
    return { success: true, messageId: response, token };
  } catch (err) {
    console.error('❌ FCM push failed:', err.message);
    throw err;
  }
};

const sendPush = sendPushNotification;

/**
 * Send to multiple tokens
 */
const sendPushNotificationToMultiple = async (fcmTokens, title, body, data = {}) => {
  try {
    if (!Array.isArray(fcmTokens) || fcmTokens.length === 0) {
      throw new Error('Invalid FCM tokens array');
    }
    const validTokens = fcmTokens.filter(t => t && typeof t === 'string' && t.trim().length >= 20);
    if (validTokens.length === 0) {
      throw new Error('No valid FCM tokens');
    }
    const message = {
      notification: { title: title || 'Notification', body: body || '' },
      data: Object.keys(data).reduce((acc, key) => {
        acc[key] = String(data[key] ?? '');
        return acc;
      }, {}),
      android: { priority: 'high', notification: { channelId: 'default' } },
      apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      tokens: validTokens,
    };
    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ FCM multicast: ${response.successCount} ok, ${response.failureCount} failed`);
    return { success: true, successCount: response.successCount, failureCount: response.failureCount, responses: response.responses };
  } catch (err) {
    console.error('❌ FCM multicast failed:', err.message);
    throw err;
  }
};

module.exports = {
  sendPushNotification,
  sendPush,
  sendPushNotificationToMultiple,
};
