import Notification from "../models/mongo/Notification.js";
import smsService from "../services/smsService.js";
import pushService from "../services/pushService.js";

export const sendSMS = async (req, res, next) => {
  const { phones, message } = req.body; // support array of phone numbers or single string
  try {
    // Normalize phones to array
    const recipients = Array.isArray(phones) ? phones : [phones];

    // Send SMS to all recipients
    await Promise.all(recipients.map(phone => smsService.sendSMS(phone, message)));

    // Log notifications in MongoDB
    await Notification.insertMany(
      recipients.map(phone => ({
        type: "SMS",
        recipient: phone,
        message,
        sentAt: new Date(),
      }))
    );

    res.status(200).json({ message: "SMS sent successfully." });
  } catch (error) {
    next(error);
  }
};

export const sendPush = async (req, res, next) => {
  const { tokens, title, body } = req.body; // support array of tokens or single string
  try {
    // Normalize tokens to array
    const recipients = Array.isArray(tokens) ? tokens : [tokens];

    // Send push to all recipients
    await Promise.all(recipients.map(token => pushService.sendPush(token, title, body)));

    // Log notifications in MongoDB
    await Notification.insertMany(
      recipients.map(token => ({
        type: "PUSH",
        recipient: token,
        message: body,
        title,
        sentAt: new Date(),
      }))
    );

    res.status(200).json({ message: "Push notification sent successfully." });
  } catch (error) {
    next(error);
  }
};
