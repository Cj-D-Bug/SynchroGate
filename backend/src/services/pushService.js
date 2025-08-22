// pushService.js - Send push notifications using Expo Push API
import fetch from 'node-fetch';

export const sendPushNotification = async (expoPushToken, title, body, data = {}) => {
  try {
    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: expoPushToken,
        sound: 'default',
        title,
        body,
        data
      })
    });

    return await response.json();
  } catch (err) {
    console.error('Push notification failed:', err);
    throw new Error('Failed to send push notification');
  }
};
