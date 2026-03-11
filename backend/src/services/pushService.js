// pushService.js - Send push notifications using Firebase Cloud Messaging (FCM)
// Works with Railway backend and Expo/React Native push tokens
const { admin } = require('../config/firebase');
const { env } = require('../config/env');

function isExpoPushToken(token) {
  if (!token || typeof token !== 'string') return false;
  return token.trim().startsWith('ExponentPushToken');
}

function getFcmErrorCode(err) {
  // firebase-admin errors often expose code like "messaging/registration-token-not-registered"
  return err?.errorInfo?.code || err?.code || err?.message || null;
}

function isInvalidRegistrationTokenError(err) {
  const code = String(getFcmErrorCode(err) || '').toLowerCase();
  return (
    code.includes('registration-token-not-registered') ||
    code.includes('invalid-registration-token') ||
    code.includes('notregistered') ||
    code.includes('invalidargument')
  );
}

async function sendExpoPushNotification(expoPushToken, title, body, data = {}) {
  if (!expoPushToken || typeof expoPushToken !== 'string' || expoPushToken.trim().length === 0) {
    throw new Error('Invalid Expo push token provided');
  }
  const token = expoPushToken.trim();
  if (!isExpoPushToken(token)) {
    throw new Error('Not an Expo push token');
  }
  if (!env.EXPO_PUSH_KEY) {
    throw new Error('EXPO_PUSH_KEY not configured on backend');
  }
  if (typeof fetch !== 'function') {
    throw new Error('Global fetch is not available (Node 18+ required for Expo push).');
  }

  const payload = {
    to: token,
    title: title || 'Notification',
    body: body || '',
    sound: 'default',
    data: {
      ...Object.keys(data).reduce((acc, key) => {
        acc[key] = data[key];
        return acc;
      }, {}),
      title: String(title || 'Notification'),
      body: String(body || ''),
    },
  };

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.EXPO_PUSH_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}

  if (!res.ok) {
    const msg = json?.errors?.[0]?.message || json?.error || text || `Expo push failed (${res.status})`;
    throw new Error(msg);
  }

  const status = json?.data?.status || json?.status || 'ok';
  if (status !== 'ok') {
    const details = json?.data?.message || json?.data?.details || json?.message || 'Unknown Expo push error';
    throw new Error(String(details));
  }

  console.log('✅ Expo push sent:', { status, id: json?.data?.id });
  return { success: true, provider: 'expo', token, response: json };
}

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

    // Expo Go / Expo push tokens must be sent via Expo push API, not Firebase Admin.
    if (isExpoPushToken(token)) {
      return await sendExpoPushNotification(token, title, body, data);
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
    return { success: true, provider: 'fcm', messageId: response, token };
  } catch (err) {
    const code = getFcmErrorCode(err);
    console.error('❌ FCM push failed:', code || err.message);
    if (isInvalidRegistrationTokenError(err)) {
      err.isInvalidToken = true;
    }
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
