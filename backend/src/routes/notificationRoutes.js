// src/routes/notificationRoutes.js
import express from 'express';
import notificationController from '../controllers/notificationController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import roleMiddleware from '../middleware/roleMiddleware.js';

const router = express.Router();

// Admin & Developer can send push notification
router.post(
  '/push',
  authMiddleware,
  roleMiddleware(['admin', 'developer']),
  notificationController.sendPushNotification
);

// Admin & Developer can send SMS notification
router.post(
  '/sms',
  authMiddleware,
  roleMiddleware(['admin', 'developer']),
  notificationController.sendSMSNotification
);

// Admin, Developer, Parent can get notifications history by userId
router.get(
  '/history/:userId',
  authMiddleware,
  roleMiddleware(['admin', 'developer', 'parent']),
  notificationController.getNotificationHistory
);

// Parent-specific route to get their notifications (frontend calls /notifications/parent)
router.get(
  '/parent',
  authMiddleware,
  roleMiddleware(['parent']),
  notificationController.getParentNotifications
);

// Optional: Log notification event internally
router.post(
  '/log',
  authMiddleware,
  roleMiddleware(['admin', 'developer']),
  notificationController.logNotificationEvent
);

export default router;
