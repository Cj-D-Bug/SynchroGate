// smsService.js - Send SMS notifications using Twilio or Semaphore
import dotenv from 'dotenv';
import twilio from 'twilio';
dotenv.config();

const useTwilio = process.env.SMS_PROVIDER === 'twilio';
let twilioClient;

if (useTwilio) {
  twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
}

export const sendSMS = async (to, message) => {
  try {
    if (useTwilio) {
      const result = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to
      });
      return result;
    } else {
      // Example Semaphore API call
      const fetch = (await import('node-fetch')).default;
      const response = await fetch('https://api.semaphore.co/api/v4/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          apikey: process.env.SEMAPHORE_API_KEY,
          number: to,
          message
        })
      });
      return await response.json();
    }
  } catch (err) {
    console.error('SMS sending failed:', err);
    throw new Error('Failed to send SMS');
  }
};
