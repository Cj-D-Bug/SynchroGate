// sessionService.js - Backend service to track active user sessions and enforce one device per user
const { firestore, admin } = require('../config/firebase');

// In-memory cache for active sessions (userId -> { deviceId, loginTime, lastActivity })
const activeSessions = new Map();

// Firestore collection name for sessions
const SESSIONS_COLLECTION = 'user_sessions';

/**
 * Get or create a device ID from request headers
 * Uses a combination of user-agent and IP address as device identifier
 */
const getDeviceId = (req) => {
  const userAgent = req.headers['user-agent'] || 'unknown';
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  // Create a simple hash-like identifier
  return `${ip}_${userAgent.substring(0, 50)}`.replace(/[^a-zA-Z0-9_]/g, '_');
};

/**
 * Check if user has an active session on a different device
 * Returns { hasActiveSession: boolean, existingDeviceId: string | null }
 */
const checkActiveSession = async (userId) => {
  try {
    // Check in-memory cache first
    const cachedSession = activeSessions.get(userId);
    if (cachedSession) {
      // Verify session still exists in Firestore
      const sessionDoc = await firestore
        .collection(SESSIONS_COLLECTION)
        .doc(userId)
        .get();
      
      if (sessionDoc.exists) {
        const sessionData = sessionDoc.data();
        // Check if session is still valid (not expired)
        const lastActivity = sessionData.lastActivity?.toDate?.() || new Date(sessionData.lastActivity);
        const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
        const isExpired = Date.now() - lastActivity.getTime() > sessionTimeout;
        
        if (!isExpired) {
          return {
            hasActiveSession: true,
            existingDeviceId: sessionData.deviceId,
            loginTime: sessionData.loginTime,
          };
        } else {
          // Session expired, remove from cache
          activeSessions.delete(userId);
        }
      } else {
        // Session doesn't exist in Firestore, remove from cache
        activeSessions.delete(userId);
      }
    }

    // Check Firestore
    const sessionDoc = await firestore
      .collection(SESSIONS_COLLECTION)
      .doc(userId)
      .get();

    if (sessionDoc.exists) {
      const sessionData = sessionDoc.data();
      const lastActivity = sessionData.lastActivity?.toDate?.() || new Date(sessionData.lastActivity);
      const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
      const isExpired = Date.now() - lastActivity.getTime() > sessionTimeout;

      if (!isExpired) {
        // Update cache
        activeSessions.set(userId, {
          deviceId: sessionData.deviceId,
          loginTime: sessionData.loginTime,
          lastActivity: lastActivity,
        });
        return {
          hasActiveSession: true,
          existingDeviceId: sessionData.deviceId,
          loginTime: sessionData.loginTime,
        };
      } else {
        // Expired session, delete it
        await firestore.collection(SESSIONS_COLLECTION).doc(userId).delete();
      }
    }

    return { hasActiveSession: false, existingDeviceId: null };
  } catch (error) {
    console.error('❌ Error checking active session:', error);
    return { hasActiveSession: false, existingDeviceId: null };
  }
};

/**
 * Create or update a user session
 */
const createSession = async (userId, deviceId) => {
  try {
    const now = new Date();
    const sessionData = {
      userId,
      deviceId,
      loginTime: admin.firestore.FieldValue.serverTimestamp(),
      lastActivity: admin.firestore.FieldValue.serverTimestamp(),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    await firestore.collection(SESSIONS_COLLECTION).doc(userId).set(sessionData, { merge: true });

    // Update cache
    activeSessions.set(userId, {
      deviceId,
      loginTime: now,
      lastActivity: now,
    });

    console.log(`✅ Session created for user ${userId} on device ${deviceId}`);
  } catch (error) {
    console.error('❌ Error creating session:', error);
    throw error;
  }
};

/**
 * Update last activity timestamp for a session
 */
const updateActivity = async (userId) => {
  try {
    const sessionDoc = await firestore
      .collection(SESSIONS_COLLECTION)
      .doc(userId)
      .get();

    if (sessionDoc.exists) {
      await firestore
        .collection(SESSIONS_COLLECTION)
        .doc(userId)
        .update({
          lastActivity: admin.firestore.FieldValue.serverTimestamp(),
        });

      // Update cache
      const cached = activeSessions.get(userId);
      if (cached) {
        cached.lastActivity = new Date();
        activeSessions.set(userId, cached);
      }
    }
  } catch (error) {
    console.error('❌ Error updating session activity:', error);
  }
};

/**
 * Delete a user session (logout)
 */
const deleteSession = async (userId) => {
  try {
    await firestore.collection(SESSIONS_COLLECTION).doc(userId).delete();
    activeSessions.delete(userId);
    console.log(`✅ Session deleted for user ${userId}`);
  } catch (error) {
    console.error('❌ Error deleting session:', error);
  }
};

/**
 * Invalidate existing session for a user (when logging in from a new device)
 */
const invalidateSession = async (userId) => {
  try {
    // Get existing session to log which device was invalidated
    const sessionDoc = await firestore
      .collection(SESSIONS_COLLECTION)
      .doc(userId)
      .get();

    if (sessionDoc.exists) {
      const sessionData = sessionDoc.data();
      console.log(`⚠️ Invalidating existing session for user ${userId} from device ${sessionData.deviceId}`);
    }

    // Delete the session
    await deleteSession(userId);
  } catch (error) {
    console.error('❌ Error invalidating session:', error);
  }
};

/**
 * Cleanup expired sessions from Firestore
 * Runs periodically to remove sessions that haven't been active for 24+ hours
 */
let cleanupInterval = null;

const cleanupExpiredSessions = async () => {
  try {
    console.log('🧹 Starting expired session cleanup...');
    const sessionsSnapshot = await firestore.collection(SESSIONS_COLLECTION).get();
    const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    let deletedCount = 0;

    for (const doc of sessionsSnapshot.docs) {
      const sessionData = doc.data();
      const lastActivity = sessionData.lastActivity?.toDate?.() || new Date(sessionData.lastActivity);
      const timeSinceActivity = now - lastActivity.getTime();

      if (timeSinceActivity > sessionTimeout) {
        await doc.ref.delete();
        activeSessions.delete(doc.id);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`✅ Cleaned up ${deletedCount} expired session(s)`);
    }
  } catch (error) {
    console.error('❌ Error cleaning up expired sessions:', error);
  }
};

/**
 * Initialize listener to monitor user login events and enforce single device rule
 * This listener watches the users collection for lastLoginAt changes
 */
let userLoginListener = null;

const initializeUserLoginListener = () => {
  if (userLoginListener) {
    console.log('⚠️ User login listener already initialized');
    return;
  }

  console.log('🔄 Initializing user login listener for single device enforcement...');

  const usersCollection = firestore.collection('users');

  userLoginListener = usersCollection.onSnapshot(async (snapshot) => {
    const changes = snapshot.docChanges();

    for (const change of changes) {
      if (change.type === 'modified') {
        const userData = change.doc.data();
        const userId = change.doc.id;
        const newLastLoginAt = userData.lastLoginAt;
        const oldLastLoginAt = change.doc.metadata.hasPendingWrites 
          ? null 
          : (await change.doc.ref.get({ source: 'cache' })).data()?.lastLoginAt;

        // Check if lastLoginAt was updated (user logged in)
        if (newLastLoginAt && newLastLoginAt !== oldLastLoginAt) {
          console.log(`🔍 Detected login event for user ${userId}`);

          // Check if there's an existing active session
          const sessionCheck = await checkActiveSession(userId);
          
          if (sessionCheck.hasActiveSession) {
            // There's an active session, but we allow the new login
            // The old session will be invalidated when the new session is created
            // This is handled in the login controller
            console.log(`⚠️ User ${userId} has existing session on device ${sessionCheck.existingDeviceId}, will be invalidated on new login`);
          }
        }
      }
    }
  }, (error) => {
    console.error('❌ Error in user login listener:', error);
  });

  // Start periodic cleanup of expired sessions (every 6 hours)
  if (!cleanupInterval) {
    cleanupInterval = setInterval(cleanupExpiredSessions, 6 * 60 * 60 * 1000);
    // Run cleanup once on startup
    cleanupExpiredSessions();
  }

  console.log('✅ User login listener initialized');
};

/**
 * Cleanup listener on shutdown
 */
const cleanupListener = () => {
  if (userLoginListener) {
    userLoginListener();
    userLoginListener = null;
    console.log('✅ User login listener cleaned up');
  }
  
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('✅ Session cleanup interval cleared');
  }
};

module.exports = {
  getDeviceId,
  checkActiveSession,
  createSession,
  updateActivity,
  deleteSession,
  invalidateSession,
  initializeUserLoginListener,
  cleanupListener,
};

