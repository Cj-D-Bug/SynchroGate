const { firestore } = require("../config/firebase");
const smsService = require("../services/smsService");
const pushService = require("../services/pushService");

exports.sendSMS = async (req, res, next) => {
  const { phones, message } = req.body; // support array of phone numbers or single string
  try {
    // Normalize phones to array
    const recipients = Array.isArray(phones) ? phones : [phones];

    // Send SMS to all recipients
    await Promise.all(recipients.map(phone => smsService.sendSMS(phone, message)));

    // Log notifications in Firebase
    const notificationsRef = firestore.collection('notifications');
    const batch = firestore.batch();
    
    recipients.forEach(phone => {
      const notificationRef = notificationsRef.doc();
      batch.set(notificationRef, {
        type: "SMS",
        recipient: phone,
        message,
        status: "sent",
        sentAt: new Date(),
        createdAt: new Date()
      });
    });
    
    await batch.commit();

    res.status(200).json({ message: "SMS sent successfully." });
  } catch (error) {
    next(error);
  }
};

exports.sendPush = async (req, res, next) => {
  const { tokens, title, body } = req.body; // support array of tokens or single string
  try {
    // Normalize tokens to array
    const recipients = Array.isArray(tokens) ? tokens : [tokens];

    // Send push to all recipients
    await Promise.all(recipients.map(token => pushService.sendPush(token, title, body)));

    // Log notifications in Firebase
    const notificationsRef = firestore.collection('notifications');
    const batch = firestore.batch();
    
    recipients.forEach(token => {
      const notificationRef = notificationsRef.doc();
      batch.set(notificationRef, {
        type: "PUSH",
        recipient: token,
        message: body,
        title,
        status: "sent",
        sentAt: new Date(),
        createdAt: new Date()
      });
    });
    
    await batch.commit();

    res.status(200).json({ message: "Push notification sent successfully." });
  } catch (error) {
    next(error);
  }
};
