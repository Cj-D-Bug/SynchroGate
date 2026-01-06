const { firestore } = require('../config/firebase');

/**
 * Verify user identity and return user data
 * @param {string} userId - User document ID (canonical ID like "9759-68433" or UID)
 * @param {string} role - Expected role ('student', 'parent', 'admin')
 * @param {object} expectedData - Optional expected fields to verify (uid, email, studentId, parentId)
 * @returns {Promise<{valid: boolean, error?: string, userData?: object}>}
 */
const verifyUserIdentity = async (userId, role, expectedData = {}) => {
  try {
    if (!userId || !role) {
      return {
        valid: false,
        error: 'userId and role are required'
      };
    }

    // Try to get user document by document ID first
    let userDoc = await firestore.collection('users').doc(userId).get();
    
    // If not found, try searching by UID
    if (!userDoc.exists && expectedData.uid) {
      const querySnapshot = await firestore.collection('users')
        .where('uid', '==', expectedData.uid)
        .limit(1)
        .get();
      
      if (!querySnapshot.empty) {
        userDoc = querySnapshot.docs[0];
      }
    }

    if (!userDoc.exists) {
      return {
        valid: false,
        error: `User ${userId} not found`
      };
    }

    const userData = userDoc.data();

    // Verify role matches
    if (String(userData.role).toLowerCase() !== String(role).toLowerCase()) {
      return {
        valid: false,
        error: `Role mismatch: expected ${role}, got ${userData.role}`
      };
    }

    // Verify expected fields if provided
    if (expectedData.uid && userData.uid !== expectedData.uid) {
      return {
        valid: false,
        error: `UID mismatch: expected ${expectedData.uid}, got ${userData.uid}`
      };
    }

    if (expectedData.email && userData.email !== expectedData.email) {
      return {
        valid: false,
        error: `Email mismatch: expected ${expectedData.email}, got ${userData.email}`
      };
    }

    if (expectedData.studentId && userData.studentId !== expectedData.studentId) {
      return {
        valid: false,
        error: `StudentId mismatch: expected ${expectedData.studentId}, got ${userData.studentId}`
      };
    }

    if (expectedData.parentId && userData.parentId !== expectedData.parentId) {
      return {
        valid: false,
        error: `ParentId mismatch: expected ${expectedData.parentId}, got ${userData.parentId}`
      };
    }

    return {
      valid: true,
      userData: {
        ...userData,
        id: userDoc.id
      }
    };
  } catch (error) {
    console.error('Error verifying user identity:', error);
    return {
      valid: false,
      error: `Verification error: ${error.message}`
    };
  }
};

/**
 * Get active parent-student links with FCM tokens
 * @param {object} params - Query parameters
 * @param {string} params.parentId - Parent UID (optional)
 * @param {string} params.parentIdNumber - Parent canonical ID (optional)
 * @param {string} params.studentId - Student UID (optional)
 * @param {string} params.studentIdNumber - Student canonical ID (optional)
 * @returns {Promise<Array>} Array of link objects with FCM tokens
 */
const getActiveLinkFcmTokens = async ({ parentId, parentIdNumber, studentId, studentIdNumber }) => {
  try {
    const links = [];
    const linksRef = firestore.collection('parent_student_links');

    // Query by parent if provided
    if (parentId || parentIdNumber) {
      let query = linksRef.where('status', '==', 'active');
      
      if (parentId) {
        query = query.where('parentId', '==', String(parentId));
      } else if (parentIdNumber) {
        query = query.where('parentIdNumber', '==', String(parentIdNumber));
      }

      const snapshot = await query.get();
      snapshot.docs.forEach(doc => {
        const linkData = doc.data();
        links.push({
          parentId: linkData.parentId,
          parentIdNumber: linkData.parentIdNumber,
          studentId: linkData.studentId,
          studentIdNumber: linkData.studentIdNumber,
          parentFcmToken: linkData.parentFcmToken || null,
          studentFcmToken: linkData.studentFcmToken || null,
          status: linkData.status,
          linkDoc: doc
        });
      });
    }

    // Query by student if provided
    if (studentId || studentIdNumber) {
      let query = linksRef.where('status', '==', 'active');
      
      if (studentId) {
        query = query.where('studentId', '==', String(studentId));
      } else if (studentIdNumber) {
        query = query.where('studentIdNumber', '==', String(studentIdNumber));
      }

      const snapshot = await query.get();
      snapshot.docs.forEach(doc => {
        const linkData = doc.data();
        
        // Avoid duplicates
        const exists = links.some(link => 
          link.parentId === linkData.parentId && 
          link.studentId === linkData.studentId
        );
        
        if (!exists) {
          links.push({
            parentId: linkData.parentId,
            parentIdNumber: linkData.parentIdNumber,
            studentId: linkData.studentId,
            studentIdNumber: linkData.studentIdNumber,
            parentFcmToken: linkData.parentFcmToken || null,
            studentFcmToken: linkData.studentFcmToken || null,
            status: linkData.status,
            linkDoc: doc
          });
        }
      });
    }

    return links;
  } catch (error) {
    console.error('Error getting active link FCM tokens:', error);
    return [];
  }
};

/**
 * Get parent-student links with FCM tokens (alias for getActiveLinkFcmTokens)
 * @param {object} params - Query parameters
 * @returns {Promise<Array>} Array of link objects with FCM tokens
 */
const getLinkFcmTokens = async (params) => {
  return getActiveLinkFcmTokens(params);
};

module.exports = {
  verifyUserIdentity,
  getActiveLinkFcmTokens,
  getLinkFcmTokens
};
