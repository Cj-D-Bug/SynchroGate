// linkFcmTokenHelper.js - Utility to get FCM tokens from parent_student_links collection
const { firestore } = require('../config/firebase');

/**
 * Get FCM tokens for both parent and student from parent_student_links
 * @param {string} linkId - The parent_student_links document ID
 * @returns {Promise<{parentFcmToken: string|null, studentFcmToken: string|null}>}
 */
const getLinkFcmTokens = async (linkId) => {
  try {
    if (!linkId) {
      return { parentFcmToken: null, studentFcmToken: null };
    }

    const linkRef = firestore.collection('parent_student_links').doc(linkId);
    const linkSnap = await linkRef.get();
    
    if (!linkSnap.exists) {
      return { parentFcmToken: null, studentFcmToken: null };
    }

    const linkData = linkSnap.data();
    return {
      parentFcmToken: linkData?.parentFcmToken || null,
      studentFcmToken: linkData?.studentFcmToken || null
    };
  } catch (error) {
    console.error('❌ Error getting FCM tokens from parent_student_links:', error);
    return { parentFcmToken: null, studentFcmToken: null };
  }
};

/**
 * Get FCM tokens for all active links involving a specific parent or student
 * @param {Object} options - Query options
 * @param {string} options.parentId - Parent ID (UID or canonical)
 * @param {string} options.parentIdNumber - Parent canonical ID
 * @param {string} options.studentId - Student ID (UID or canonical)
 * @param {string} options.studentIdNumber - Student canonical ID
 * @returns {Promise<Array<{linkId: string, parentFcmToken: string|null, studentFcmToken: string|null, parentId: string, studentId: string}>>}
 */
const getActiveLinkFcmTokens = async ({ parentId, parentIdNumber, studentId, studentIdNumber }) => {
  try {
    const links = [];
    const seenLinkIds = new Set();
    
    // Query by parentId (UID)
    if (parentId) {
      try {
        const q1 = await firestore.collection('parent_student_links')
          .where('parentId', '==', parentId)
          .where('status', '==', 'active')
          .get();
        
        q1.forEach(doc => {
          if (!seenLinkIds.has(doc.id)) {
            const data = doc.data();
            links.push({
              linkId: doc.id,
              parentFcmToken: data?.parentFcmToken || null,
              studentFcmToken: data?.studentFcmToken || null,
              parentId: data?.parentId || null,
              studentId: data?.studentId || null
            });
            seenLinkIds.add(doc.id);
          }
        });
      } catch (e) {
        console.error('Error querying links by parentId:', e.message);
      }
    }

    // Query by parentIdNumber (canonical)
    if (parentIdNumber && parentIdNumber !== parentId) {
      try {
        const q2 = await firestore.collection('parent_student_links')
          .where('parentIdNumber', '==', parentIdNumber)
          .where('status', '==', 'active')
          .get();
        
        q2.forEach(doc => {
          if (!seenLinkIds.has(doc.id)) {
            const data = doc.data();
            links.push({
              linkId: doc.id,
              parentFcmToken: data?.parentFcmToken || null,
              studentFcmToken: data?.studentFcmToken || null,
              parentId: data?.parentId || null,
              studentId: data?.studentId || null
            });
            seenLinkIds.add(doc.id);
          }
        });
      } catch (e) {
        console.error('Error querying links by parentIdNumber:', e.message);
      }
    }

    // Query by studentId (UID)
    if (studentId) {
      try {
        const q3 = await firestore.collection('parent_student_links')
          .where('studentId', '==', studentId)
          .where('status', '==', 'active')
          .get();
        
        q3.forEach(doc => {
          if (!seenLinkIds.has(doc.id)) {
            const data = doc.data();
            links.push({
              linkId: doc.id,
              parentFcmToken: data?.parentFcmToken || null,
              studentFcmToken: data?.studentFcmToken || null,
              parentId: data?.parentId || null,
              studentId: data?.studentId || null
            });
            seenLinkIds.add(doc.id);
          }
        });
      } catch (e) {
        console.error('Error querying links by studentId:', e.message);
      }
    }

    // Query by studentIdNumber (canonical)
    if (studentIdNumber && studentIdNumber !== studentId) {
      try {
        const q4 = await firestore.collection('parent_student_links')
          .where('studentIdNumber', '==', studentIdNumber)
          .where('status', '==', 'active')
          .get();
        
        q4.forEach(doc => {
          if (!seenLinkIds.has(doc.id)) {
            const data = doc.data();
            links.push({
              linkId: doc.id,
              parentFcmToken: data?.parentFcmToken || null,
              studentFcmToken: data?.studentFcmToken || null,
              parentId: data?.parentId || null,
              studentId: data?.studentId || null
            });
            seenLinkIds.add(doc.id);
          }
        });
      } catch (e) {
        console.error('Error querying links by studentIdNumber:', e.message);
      }
    }

    return links;
  } catch (error) {
    console.error('❌ Error getting active link FCM tokens:', error);
    return [];
  }
};

/**
 * Verify complete user identity before sending notification
 * Checks: firstName, lastName, uid, studentId/parentId, email, fcmToken
 * @param {string} userId - User document ID
 * @param {string} role - User role ('student' or 'parent')
 * @param {Object} expectedData - Expected user data to verify against (optional)
 * @returns {Promise<{valid: boolean, userData: Object|null, error: string|null}>}
 */
const verifyUserIdentity = async (userId, role, expectedData = {}) => {
  try {
    // Get user document
    const userDoc = await firestore.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return { valid: false, userData: null, error: 'User document does not exist' };
    }
    
    const userData = userDoc.data();
    
    // Check all required fields
    if (!userData?.role) {
      return { valid: false, userData: null, error: 'User has no role' };
    }
    
    if (!userData?.uid) {
      return { valid: false, userData: null, error: 'User has no uid' };
    }
    
    if (!userData?.fcmToken) {
      return { valid: false, userData: null, error: 'User has no fcmToken' };
    }
    
    // Verify role matches
    if (String(userData.role).toLowerCase() !== role.toLowerCase()) {
      return { valid: false, userData: null, error: `Role mismatch: expected ${role}, got ${userData.role}` };
    }
    
    // Check login timestamp and recency
    const lastLoginAt = userData?.lastLoginAt || userData?.pushTokenUpdatedAt;
    if (!lastLoginAt) {
      return { valid: false, userData: null, error: 'User never logged in (no timestamp)' };
    }
    
    // Check if login is recent (within 30 days)
    let loginTimestampMs = null;
    try {
      if (typeof lastLoginAt === 'string') {
        loginTimestampMs = new Date(lastLoginAt).getTime();
      } else if (lastLoginAt.toMillis) {
        loginTimestampMs = lastLoginAt.toMillis();
      } else if (lastLoginAt.seconds) {
        loginTimestampMs = lastLoginAt.seconds * 1000;
      } else if (typeof lastLoginAt === 'number') {
        loginTimestampMs = lastLoginAt > 1000000000000 ? lastLoginAt : lastLoginAt * 1000;
      }
    } catch (e) {
      return { valid: false, userData: null, error: 'Invalid login timestamp format' };
    }
    
    if (!loginTimestampMs || isNaN(loginTimestampMs)) {
      return { valid: false, userData: null, error: 'Invalid login timestamp' };
    }
    
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const timeSinceLogin = Date.now() - loginTimestampMs;
    
    if (timeSinceLogin > THIRTY_DAYS_MS) {
      return { valid: false, userData: null, error: `User last logged in ${Math.floor(timeSinceLogin / (24 * 60 * 60 * 1000))} days ago (more than 30 days)` };
    }
    
    // Verify document ID matches user's ID field
    if (role === 'student') {
      const userStudentId = userData.studentId || userData.studentIdNumber;
      if (!userStudentId) {
        return { valid: false, userData: null, error: 'User has no studentId field' };
      }
      const normalizedUserStudentId = String(userStudentId).replace(/-/g, '').trim().toLowerCase();
      const normalizedUserId = String(userId).replace(/-/g, '').trim().toLowerCase();
      if (normalizedUserStudentId !== normalizedUserId) {
        return { valid: false, userData: null, error: `Document ID (${userId}) doesn't match user's studentId (${userStudentId})` };
      }
    } else if (role === 'parent') {
      const userParentId = userData.parentId || userData.parentIdNumber;
      if (!userParentId) {
        return { valid: false, userData: null, error: 'User has no parentId field' };
      }
      const normalizedUserParentId = String(userParentId).replace(/-/g, '').trim().toLowerCase();
      const normalizedUserId = String(userId).replace(/-/g, '').trim().toLowerCase();
      if (normalizedUserParentId !== normalizedUserId) {
        return { valid: false, userData: null, error: `Document ID (${userId}) doesn't match user's parentId (${userParentId})` };
      }
    }
    
    // If expectedData is provided, verify it matches
    if (expectedData.uid && userData.uid !== expectedData.uid) {
      return { valid: false, userData: null, error: 'UID mismatch' };
    }
    
    if (expectedData.email && userData.email !== expectedData.email) {
      return { valid: false, userData: null, error: 'Email mismatch' };
    }
    
    if (expectedData.studentId && role === 'student') {
      const normalizedExpected = String(expectedData.studentId).replace(/-/g, '').trim().toLowerCase();
      const normalizedActual = String(userData.studentId || '').replace(/-/g, '').trim().toLowerCase();
      if (normalizedExpected !== normalizedActual) {
        return { valid: false, userData: null, error: 'StudentId mismatch' };
      }
    }
    
    if (expectedData.parentId && role === 'parent') {
      const normalizedExpected = String(expectedData.parentId).replace(/-/g, '').trim().toLowerCase();
      const normalizedActual = String(userData.parentId || '').replace(/-/g, '').trim().toLowerCase();
      if (normalizedExpected !== normalizedActual) {
        return { valid: false, userData: null, error: 'ParentId mismatch' };
      }
    }
    
    // Return complete user data
    return {
      valid: true,
      userData: {
        uid: userData.uid,
        firstName: userData.firstName || '',
        lastName: userData.lastName || '',
        email: userData.email || '',
        parentId: userData.parentId || userData.parentIdNumber || null,
        studentId: userData.studentId || userData.studentIdNumber || null,
        fcmToken: userData.fcmToken,
        role: userData.role,
        lastLoginAt: lastLoginAt
      },
      error: null
    };
  } catch (error) {
    console.error('❌ Error verifying user identity:', error);
    return { valid: false, userData: null, error: error.message };
  }
};

module.exports = {
  getLinkFcmTokens,
  getActiveLinkFcmTokens,
  verifyUserIdentity
};
