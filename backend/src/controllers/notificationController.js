const { firestore } = require("../config/firebase");
const smsService = require("../services/smsService");
const pushService = require("../services/pushService");
const { verifyUserIdentity, getLinkFcmTokens, getActiveLinkFcmTokens } = require("../utils/linkFcmTokenHelper");

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

/**
 * Send push notification - STRICT VALIDATION
 * Requires userId and role, verifies complete user identity before sending
 * For linked users (student/parent), uses FCM tokens from parent_student_links
 * @param {Object} req.body - { userId, role, title, body, data, expectedData? }
 * @param {string} req.body.userId - User document ID (studentId, parentId, or 'Admin')
 * @param {string} req.body.role - User role ('student', 'parent', 'admin')
 * @param {string} req.body.title - Notification title
 * @param {string} req.body.body - Notification body/message
 * @param {Object} req.body.data - Additional notification data
 * @param {Object} req.body.expectedData - Expected user data to verify (optional)
 */
const sendPushNotification = async (req, res, next) => {
  try {
    const { userId, role, title, body, data, expectedData } = req.body;
    
    // CRITICAL: Require userId and role - no longer accept raw tokens
    if (!userId || !role) {
      return res.status(400).json({ 
        error: "userId and role are required. This endpoint now requires user verification." 
      });
    }
    
    if (!title || !body) {
      return res.status(400).json({ error: "title and body are required" });
    }
    
    // Verify user identity (checks firstName, lastName, uid, studentId/parentId, email, fcmToken, login recency)
    const verification = await verifyUserIdentity(userId, role, expectedData || {});
    
    if (!verification.valid) {
      return res.status(403).json({ 
        error: `User verification failed: ${verification.error}` 
      });
    }
    
    const userData = verification.userData;
    
    // For linked users (student/parent), check if we should use FCM token from parent_student_links
    // This applies when notification is for attendance_scan or other linked-user events
    let fcmTokenToUse = userData.fcmToken;
    
    if ((role === 'parent' || role === 'student') && data?.type === 'attendance_scan') {
      // Get active links for this user
      const links = await getActiveLinkFcmTokens({
        parentId: role === 'parent' ? userData.uid : null,
        parentIdNumber: role === 'parent' ? userData.parentId : null,
        studentId: role === 'student' ? userData.uid : null,
        studentIdNumber: role === 'student' ? userData.studentId : null
      });
      
      // Use FCM token from link if available
      if (links.length > 0) {
        const link = links[0]; // Use first active link
        if (role === 'parent' && link.parentFcmToken) {
          fcmTokenToUse = link.parentFcmToken;
          console.log(`✅ Using FCM token from parent_student_links for parent ${userId}`);
        } else if (role === 'student' && link.studentFcmToken) {
          fcmTokenToUse = link.studentFcmToken;
          console.log(`✅ Using FCM token from parent_student_links for student ${userId}`);
        }
      }
    }
    
    // Send notification
    const result = await pushService.sendPush(
      fcmTokenToUse,
      title,
      body,
      {
        ...data,
        userId: userId,
        role: role,
        // Include user identity in data for app verification
        userUid: userData.uid,
        userEmail: userData.email,
        userFirstName: userData.firstName,
        userLastName: userData.lastName
      }
    );
    
    // Log notification in Firebase
    try {
      const notificationsRef = firestore.collection('notifications');
      await notificationsRef.add({
        type: "PUSH",
        userId: userId,
        role: role,
        recipient: fcmTokenToUse.substring(0, 20) + '...', // Store partial token for privacy
        message: body,
        title,
        status: "sent",
        sentAt: new Date(),
        createdAt: new Date()
      });
    } catch (logError) {
      console.warn('Failed to log notification:', logError);
      // Don't fail the request if logging fails
    }
    
    res.status(200).json({ 
      message: "Push notification sent successfully.",
      messageId: result.messageId,
      userId: userId,
      role: role,
      verified: true
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
 * Send push notification for an alert - STRICT VALIDATION
 * ONLY sends to the exact logged-in user who owns the alert
 * For linked users (student/parent), uses FCM tokens from parent_student_links
 */
const sendAlertPushNotification = async (req, res, next) => {
  try {
    const { alert, userId, role } = req.body;
    
    if (!alert || !userId || !role) {
      return res.status(400).json({ error: "Alert, userId, and role are required" });
    }

    // CRITICAL STEP 1: Verify complete user identity (firstName, lastName, uid, studentId/parentId, email, fcmToken)
    const verification = await verifyUserIdentity(userId, role, {
      uid: alert.uid || null,
      email: alert.email || null,
      studentId: alert.studentId || null,
      parentId: alert.parentId || null
    });
    
    if (!verification.valid) {
      return res.status(403).json({ 
        error: `User verification failed: ${verification.error}` 
      });
    }
    
    const userData = verification.userData;
    
    // CRITICAL STEP 2: Verify alert belongs to this user
    if (role === 'student') {
      const alertStudentId = alert.studentId || alert.student_id;
      if (alertStudentId) {
        const normalizedAlertStudentId = String(alertStudentId).replace(/-/g, '').trim().toLowerCase();
        const normalizedUserId = String(userId).replace(/-/g, '').trim().toLowerCase();
        if (normalizedAlertStudentId !== normalizedUserId) {
          return res.status(403).json({ error: "Alert doesn't belong to this student" });
        }
      }
    } else if (role === 'parent') {
      const alertParentId = alert.parentId || alert.parent_id;
      if (alertParentId) {
        const normalizedAlertParentId = String(alertParentId).replace(/-/g, '').trim().toLowerCase();
        const normalizedUserId = String(userId).replace(/-/g, '').trim().toLowerCase();
        if (normalizedAlertParentId !== normalizedUserId && alertParentId !== userData.uid) {
          return res.status(403).json({ error: "Alert doesn't belong to this parent" });
        }
      }
      
      // CRITICAL: For parent alerts, MUST verify active link to student
      if (alert.studentId) {
        let linkFound = false;
        let linkDocument = null;
        
        // Try multiple queries to find the link
        try {
          const linkQuery1 = await firestore.collection('parent_student_links')
            .where('parentId', '==', userData.uid)
            .where('studentId', '==', alert.studentId)
            .where('status', '==', 'active')
            .limit(1)
            .get();
          
          if (!linkQuery1.empty) {
            linkFound = true;
            linkDocument = linkQuery1.docs[0];
          }
        } catch (e) {}
        
        if (!linkFound && userData.parentId && userData.parentId !== userData.uid) {
          try {
            const linkQuery2 = await firestore.collection('parent_student_links')
              .where('parentIdNumber', '==', userData.parentId)
              .where('studentId', '==', alert.studentId)
              .where('status', '==', 'active')
              .limit(1)
              .get();
            
            if (!linkQuery2.empty) {
              linkFound = true;
              linkDocument = linkQuery2.docs[0];
            }
          } catch (e) {}
        }
        
        if (!linkFound) {
          return res.status(403).json({ error: "Parent not actively linked to student" });
        }
        
        // For attendance_scan alerts, use FCM token from parent_student_links if available
        if (linkDocument && (alert.type === 'attendance_scan' || alert.alertType === 'attendance_scan')) {
          const linkData = linkDocument.data();
          const linkParentFcmToken = linkData?.parentFcmToken || null;
          
          if (linkParentFcmToken) {
            // Use FCM token from parent_student_links for attendance scans
            const title = alert.title || 'New Alert';
            const body = alert.message || alert.body || 'You have a new alert';
            
            console.log(`✅ Using FCM token from parent_student_links for parent ${userId}`);
            
            const result = await pushService.sendPush(
              linkParentFcmToken,
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
            
            return res.status(200).json({ 
              message: "Push notification sent successfully using link token.",
              messageId: result.messageId,
              source: 'parent_student_links'
            });
          }
        }
      }
    }
    
    // Send notification using FCM token from users collection
    // This is for non-attendance_scan alerts OR if link token is not available
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
      messageId: result.messageId,
      source: 'users_collection'
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
 * Send push notification for an alert - STRICT VALIDATION
 * ONLY sends to the exact logged-in user who owns the alert
 * For linked users (student/parent), uses FCM tokens from parent_student_links
 */
const sendAlertPushNotification = async (req, res, next) => {
  try {
    const { alert, userId, role } = req.body;
    
    if (!alert || !userId || !role) {
      return res.status(400).json({ error: "Alert, userId, and role are required" });
    }

    // CRITICAL STEP 1: Verify complete user identity (firstName, lastName, uid, studentId/parentId, email, fcmToken)
    const verification = await verifyUserIdentity(userId, role, {
      uid: alert.uid || null,
      email: alert.email || null,
      studentId: alert.studentId || null,
      parentId: alert.parentId || null
    });
    
    if (!verification.valid) {
      return res.status(403).json({ 
        error: `User verification failed: ${verification.error}` 
      });
    }
    
    const userData = verification.userData;
    
    // CRITICAL STEP 2: Verify alert belongs to this user
    if (role === 'student') {
      const alertStudentId = alert.studentId || alert.student_id;
      if (alertStudentId) {
        const normalizedAlertStudentId = String(alertStudentId).replace(/-/g, '').trim().toLowerCase();
        const normalizedUserId = String(userId).replace(/-/g, '').trim().toLowerCase();
        if (normalizedAlertStudentId !== normalizedUserId) {
          return res.status(403).json({ error: "Alert doesn't belong to this student" });
        }
      }
    } else if (role === 'parent') {
      const alertParentId = alert.parentId || alert.parent_id;
      if (alertParentId) {
        const normalizedAlertParentId = String(alertParentId).replace(/-/g, '').trim().toLowerCase();
        const normalizedUserId = String(userId).replace(/-/g, '').trim().toLowerCase();
        if (normalizedAlertParentId !== normalizedUserId && alertParentId !== userData.uid) {
          return res.status(403).json({ error: "Alert doesn't belong to this parent" });
        }
      }
      
      // CRITICAL: For parent alerts, MUST verify active link to student
      if (alert.studentId) {
        let linkFound = false;
        let linkDocument = null;
        
        // Try multiple queries to find the link
        try {
          const linkQuery1 = await firestore.collection('parent_student_links')
            .where('parentId', '==', userData.uid)
            .where('studentId', '==', alert.studentId)
            .where('status', '==', 'active')
            .limit(1)
            .get();
          
          if (!linkQuery1.empty) {
            linkFound = true;
            linkDocument = linkQuery1.docs[0];
          }
        } catch (e) {}
        
        if (!linkFound && userData.parentId && userData.parentId !== userData.uid) {
          try {
            const linkQuery2 = await firestore.collection('parent_student_links')
              .where('parentIdNumber', '==', userData.parentId)
              .where('studentId', '==', alert.studentId)
              .where('status', '==', 'active')
              .limit(1)
              .get();
            
            if (!linkQuery2.empty) {
              linkFound = true;
              linkDocument = linkQuery2.docs[0];
            }
          } catch (e) {}
        }
        
        if (!linkFound) {
          return res.status(403).json({ error: "Parent not actively linked to student" });
        }
        
        // For attendance_scan alerts, use FCM token from parent_student_links if available
        if (linkDocument && (alert.type === 'attendance_scan' || alert.alertType === 'attendance_scan')) {
          const linkData = linkDocument.data();
          const linkParentFcmToken = linkData?.parentFcmToken || null;
          
          if (linkParentFcmToken) {
            // Use FCM token from parent_student_links for attendance scans
            const title = alert.title || 'New Alert';
            const body = alert.message || alert.body || 'You have a new alert';
            
            console.log(`✅ Using FCM token from parent_student_links for parent ${userId}`);
            
            const result = await pushService.sendPush(
              linkParentFcmToken,
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
            
            return res.status(200).json({ 
              message: "Push notification sent successfully using link token.",
              messageId: result.messageId,
              source: 'parent_student_links'
            });
          }
        }
      }
    }
    
    // Send notification using FCM token from users collection
    // This is for non-attendance_scan alerts OR if link token is not available
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
      messageId: result.messageId,
      source: 'users_collection'
    });
  } catch (error) {
    console.error('Error in sendAlertPushNotification:', error);
    next(error);
  }
};
