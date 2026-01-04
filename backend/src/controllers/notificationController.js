const { firestore } = require("../config/firebase");
const smsService = require("../services/smsService");
const pushService = require("../services/pushService");

const sendSMSNotification = async (req, res, next) => {
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

const sendPushNotification = async (req, res, next) => {
  const { tokens, fcmToken, title, body, data } = req.body; 
  // Support both 'tokens' (array) and 'fcmToken' (single token) for backward compatibility
  // Also support 'data' parameter for additional notification data
  try {
    // Normalize tokens to array - support both 'tokens' and 'fcmToken' parameters
    let recipients = [];
    if (tokens) {
      recipients = Array.isArray(tokens) ? tokens : [tokens];
    } else if (fcmToken) {
      recipients = [fcmToken];
    } else {
      return res.status(400).json({ error: "Either 'tokens' or 'fcmToken' is required" });
    }

    // Filter out invalid tokens
    const validTokens = recipients.filter(token => token && typeof token === 'string' && token.length > 0);
    
    if (validTokens.length === 0) {
      return res.status(400).json({ error: "No valid FCM tokens provided" });
    }

    // Use multicast for multiple tokens, single send for one token
    let results;
    if (validTokens.length === 1) {
      const result = await pushService.sendPush(validTokens[0], title, body, data || {});
      results = [result];
    } else {
      const multicastResult = await pushService.sendPushNotificationToMultiple(validTokens, title, body, data || {});
      results = multicastResult.responses || [];
    }

    // Log notifications in Firebase
    const notificationsRef = firestore.collection('notifications');
    const batch = firestore.batch();
    
    validTokens.forEach((token, index) => {
      const notificationRef = notificationsRef.doc();
      const result = results[index] || {};
      const success = result.success !== false;
      
      batch.set(notificationRef, {
        type: "PUSH",
        recipient: token.substring(0, 20) + '...', // Store partial token for privacy
        message: body,
        title,
        status: success ? "sent" : "failed",
        error: result.error || null,
        sentAt: new Date(),
        createdAt: new Date()
      });
    });
    
    await batch.commit();

    const successCount = results.filter(r => r.success !== false).length;
    const failureCount = results.length - successCount;

    res.status(200).json({ 
      message: "Push notification processed.",
      successCount,
      failureCount,
      total: validTokens.length
    });
  } catch (error) {
    console.error('Error in sendPushNotification:', error);
    next(error);
  }
};

// Add placeholder methods for other routes if needed
const getNotificationHistory = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const notificationsRef = firestore.collection('notifications');
    const snapshot = await notificationsRef
      .where('userId', '==', userId)
      .orderBy('sentAt', 'desc')
      .get();
    
    const notifications = [];
    snapshot.forEach(doc => {
      notifications.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

const getParentNotifications = async (req, res, next) => {
  try {
    const userId = req.user.uid; // Assuming user ID from auth middleware
    const notificationsRef = firestore.collection('notifications');
    const snapshot = await notificationsRef
      .where('userId', '==', userId)
      .orderBy('sentAt', 'desc')
      .limit(50)
      .get();
    
    const notifications = [];
    snapshot.forEach(doc => {
      notifications.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(notifications);
  } catch (error) {
    next(error);
  }
};

const logNotificationEvent = async (req, res, next) => {
  try {
    const { type, recipient, message, title } = req.body;
    const notificationsRef = firestore.collection('notifications');
    await notificationsRef.add({
      type,
      recipient,
      message,
      title,
      status: 'logged',
      createdAt: new Date(),
      sentAt: new Date()
    });
    
    res.status(201).json({ message: "Notification event logged successfully." });
  } catch (error) {
    next(error);
  }
};

/**
 * Send push notification for an alert - SIMPLIFIED
 * Only sends to logged-in users with proper role and links
 */
const sendAlertPushNotification = async (req, res, next) => {
  try {
    const { alert, userId, role } = req.body;
    
    if (!alert || !userId) {
      return res.status(400).json({ error: "Alert and userId are required" });
    }

    // Get user document
    // CRITICAL: userId can be UID or canonical ID, we need to find the user document
    let userDoc = await firestore.collection('users').doc(userId).get();
    
    if (!userDoc.exists && (role === 'admin' || role === 'developer')) {
      const altId = role === 'admin' ? 'Admin' : 'Developer';
      userDoc = await firestore.collection('users').doc(altId).get();
    }
    
    // Try querying by UID if still not found (userId might be canonical ID)
    if (!userDoc.exists) {
      const querySnapshot = await firestore.collection('users')
        .where('uid', '==', userId)
        .limit(1)
        .get();
      if (!querySnapshot.empty) {
        userDoc = querySnapshot.docs[0];
      }
    }
    
    // For students/parents, also try querying by studentId/parentId if userId is canonical
    if (!userDoc.exists && (role === 'student' || role === 'parent')) {
      const fieldName = role === 'student' ? 'studentId' : 'parentId';
      const querySnapshot = await firestore.collection('users')
        .where(fieldName, '==', userId)
        .limit(1)
        .get();
      if (!querySnapshot.empty) {
        userDoc = querySnapshot.docs[0];
      }
    }

    if (!userDoc.exists) {
      return res.status(404).json({ error: "User not found" });
    }
    
    const userData = userDoc.data();
    
    // CRITICAL: User must be logged in
    if (!userData?.role || !userData?.uid || !userData?.fcmToken) {
      return res.status(403).json({ error: "User not logged in" });
    }
    
    // Must have login timestamp (proves user has logged in)
    const lastLoginAt = userData?.lastLoginAt || userData?.pushTokenUpdatedAt;
    if (!lastLoginAt) {
      return res.status(403).json({ error: "User not logged in" });
    }
    
    // Role must match
    if (String(userData.role).toLowerCase() !== role) {
      return res.status(403).json({ error: "Role mismatch" });
    }
    
    // CRITICAL: Validate alert target matches userId
    // userId can be UID or canonical ID, alert.parentId/studentId can also be either
    if (role === 'student') {
      const alertStudentId = alert.studentId || alert.student_id;
      if (alertStudentId) {
        // Normalize both IDs for comparison
        const normalizedAlertStudentId = String(alertStudentId).replace(/-/g, '').trim();
        const normalizedUserId = String(userId).replace(/-/g, '').trim();
        const normalizedUserStudentId = String(userData?.studentId || '').replace(/-/g, '').trim();
        // Check if alert is for this student
        if (normalizedAlertStudentId !== normalizedUserId && 
            normalizedAlertStudentId !== normalizedUserStudentId &&
            alertStudentId !== userId &&
            alertStudentId !== userData?.studentId) {
          return res.status(403).json({ error: "Alert not for this student" });
        }
      }
    } else if (role === 'parent') {
      const alertParentId = alert.parentId || alert.parent_id;
      if (alertParentId) {
        // Normalize both IDs for comparison
        const normalizedAlertParentId = String(alertParentId).replace(/-/g, '').trim();
        const normalizedUserId = String(userId).replace(/-/g, '').trim();
        const normalizedUserParentId = String(userData?.parentId || '').replace(/-/g, '').trim();
        // Check if alert is for this parent
        if (normalizedAlertParentId !== normalizedUserId && 
            normalizedAlertParentId !== normalizedUserParentId &&
            alertParentId !== userId &&
            alertParentId !== userData?.parentId) {
          return res.status(403).json({ error: "Alert not for this parent" });
        }
      }
      
      // For parent alerts, also verify link to student
      if (alert.studentId) {
        const linkQuery = await firestore.collection('parent_student_links')
          .where('parentId', '==', userData.uid)
          .where('studentId', '==', alert.studentId)
          .where('status', '==', 'active')
          .limit(1)
          .get();
        
        if (linkQuery.empty) {
          const parentIdNumber = userData?.parentId || userData?.parentIdNumber || userId;
          if (parentIdNumber !== userData.uid) {
            const linkQuery2 = await firestore.collection('parent_student_links')
              .where('parentIdNumber', '==', parentIdNumber)
              .where('studentId', '==', alert.studentId)
              .where('status', '==', 'active')
              .limit(1)
              .get();
            
            if (linkQuery2.empty) {
              return res.status(403).json({ error: "Parent not linked to student" });
            }
          } else {
            return res.status(403).json({ error: "Parent not linked to student" });
          }
        }
      }
    }
    
    // Send notification
    const title = alert.title || 'New Alert';
    const body = alert.message || alert.body || 'You have a new alert';
    
    const result = await pushService.sendPush(
      userData.fcmToken,
      title,
      body,
      {
        type: 'alert',
        alertId: alert.id || alert.alertId,
        alertType: alert.type || alert.alertType,
        studentId: alert.studentId || '',
        parentId: alert.parentId || '',
        status: alert.status || 'unread',
        ...alert
      }
    );
    
    res.status(200).json({ 
      message: "Push notification sent successfully.",
      messageId: result.messageId
    });
  } catch (error) {
    console.error('Error in sendAlertPushNotification:', error);
    next(error);
  }
};

module.exports = {
  sendSMSNotification,
  sendPushNotification,
  getNotificationHistory,
  getParentNotifications,
  logNotificationEvent,
  sendAlertPushNotification
};
