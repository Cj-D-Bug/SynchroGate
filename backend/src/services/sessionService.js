// sessionService.js - Backend service to track active user sessions and enforce one device per user and one user per role
const { firestore, admin } = require('../config/firebase');

// In-memory cache for active sessions (userId -> { deviceId, loginTime, lastActivity, role })
const activeSessions = new Map();

// Firestore collection name for sessions
const SESSIONS_COLLECTION = 'user_sessions';

/**
 * Get or create a device ID from request headers
 * Uses a combination of user-agent, IP address, and accept-language as device identifier
 * More reliable than just IP+UA for detecting different devices
 */
const getDeviceId = (req) => {
  const userAgent = req.headers['user-agent'] || 'unknown';
  // Try to get real IP (check x-forwarded-for for proxies, x-real-ip, then fallback)
  const forwardedFor = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  let ip = forwardedFor ? forwardedFor.split(',')[0].trim() : (realIp || req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress || 'unknown');
  
  // For localhost, try to get more unique identifiers
  if (ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1' || ip.includes('localhost')) {
    // Use a combination of headers that might differ between devices
    const acceptLanguage = req.headers['accept-language'] || 'unknown';
    const acceptEncoding = req.headers['accept-encoding'] || 'unknown';
    const acceptCharset = req.headers['accept-charset'] || 'unknown';
    const secChUa = req.headers['sec-ch-ua'] || 'unknown';
    const secChUaPlatform = req.headers['sec-ch-ua-platform'] || 'unknown';
    
    // Create a more unique fingerprint for localhost devices
    const deviceFingerprint = `localhost_${userAgent.substring(0, 100)}_${acceptLanguage.substring(0, 50)}_${acceptEncoding.substring(0, 30)}_${acceptCharset.substring(0, 20)}_${secChUa.substring(0, 50)}_${secChUaPlatform.substring(0, 30)}`;
    return deviceFingerprint.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 200);
  }
  
  const acceptLanguage = req.headers['accept-language'] || 'unknown';
  const acceptEncoding = req.headers['accept-encoding'] || 'unknown';
  
  // Create a more stable device fingerprint
  // Include more headers to better distinguish devices
  const deviceFingerprint = `${ip}_${userAgent.substring(0, 100)}_${acceptLanguage.substring(0, 50)}_${acceptEncoding.substring(0, 30)}`;
  
  // Create a simple hash-like identifier (remove special chars)
  return deviceFingerprint.replace(/[^a-zA-Z0-9_]/g, '_').substring(0, 200);
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
            role: sessionData.role,
            existingUserId: userId,
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
          role: sessionData.role,
        });
        return {
          hasActiveSession: true,
          existingDeviceId: sessionData.deviceId,
          loginTime: sessionData.loginTime,
          role: sessionData.role,
          existingUserId: userId,
        };
      } else {
        // Expired session, delete it
        await firestore.collection(SESSIONS_COLLECTION).doc(userId).delete();
      }
    }

    return { hasActiveSession: false, existingDeviceId: null, role: null, existingUserId: null };
  } catch (error) {
    console.error('❌ Error checking active session:', error);
    return { hasActiveSession: false, existingDeviceId: null, role: null, existingUserId: null };
  }
};

/**
 * Create or update a user session
 */
const createSession = async (userId, deviceId, role) => {
  try {
    const now = new Date();
    const sessionData = {
      userId,
      deviceId,
      role: role ? role.toLowerCase() : null,
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
      role: role ? role.toLowerCase() : null,
    });

    console.log(`✅ Session created for user ${userId} (role: ${role}) on device ${deviceId}`);
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
      console.log(`⚠️ Invalidating existing session for user ${userId} (role: ${sessionData.role}) from device ${sessionData.deviceId}`);
    }

    // Delete the session
    await deleteSession(userId);
  } catch (error) {
    console.error('❌ Error invalidating session:', error);
  }
};

/**
 * Check if there's an active session for a specific role
 * Returns { hasActiveSession: boolean, existingUserId: string | null, existingDeviceId: string | null }
 */
const checkActiveSessionByRole = async (role) => {
  try {
    if (!role) {
      return { hasActiveSession: false, existingUserId: null, existingDeviceId: null };
    }

    const normalizedRole = role.toLowerCase();
    const sessionTimeout = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();

    // Check Firestore for active sessions with this role
    const sessionsSnapshot = await firestore
      .collection(SESSIONS_COLLECTION)
      .where('role', '==', normalizedRole)
      .get();

    for (const doc of sessionsSnapshot.docs) {
      const sessionData = doc.data();
      const lastActivity = sessionData.lastActivity?.toDate?.() || new Date(sessionData.lastActivity);
      const isExpired = now - lastActivity.getTime() > sessionTimeout;

      if (!isExpired) {
        return {
          hasActiveSession: true,
          existingUserId: sessionData.userId || doc.id,
          existingDeviceId: sessionData.deviceId,
        };
      } else {
        // Expired session, delete it
        await doc.ref.delete();
        activeSessions.delete(doc.id);
      }
    }

    return { hasActiveSession: false, existingUserId: null, existingDeviceId: null };
  } catch (error) {
    console.error('❌ Error checking active session by role:', error);
    return { hasActiveSession: false, existingUserId: null, existingDeviceId: null };
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
      try {
        if (change.type === 'modified') {
          const userData = change.doc.data();
          const userId = change.doc.id;
          const newLastLoginAt = userData.lastLoginAt;
          
          // Safely check metadata - it may be undefined in some Firestore versions
          const hasPendingWrites = change.doc.metadata?.hasPendingWrites ?? false;
          const oldLastLoginAt = hasPendingWrites 
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
      } catch (error) {
        console.error(`❌ Error processing change for document ${change.doc?.id || 'unknown'}:`, error);
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
  checkActiveSessionByRole,
  createSession,
  updateActivity,
  deleteSession,
  invalidateSession,
  initializeUserLoginListener,
  cleanupListener,
};

