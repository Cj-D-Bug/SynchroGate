// linkFcmTokenHelper.js - Resolve FCM token for a user (backend)
const { firestore } = require('../config/firebase');

async function getFcmTokenForUser(userId) {
  if (!userId) return null;
  try {
    const doc = await firestore.collection('users').doc(String(userId)).get();
    if (!doc.exists) return null;
    const data = doc.data() || {};
    return data.fcmToken || null;
  } catch (e) {
    console.warn('getFcmTokenForUser error:', e.message);
    return null;
  }
}

async function getLinkFcmTokens(parentUserId, studentId) {
  const userDoc = await firestore.collection('users').doc(String(parentUserId)).get();
  if (userDoc.exists && (userDoc.data() || {}).fcmToken) {
    return [(userDoc.data() || {}).fcmToken];
  }
  const linkSnap = await firestore.collection('parent_student_links')
    .where('parentIdNumber', '==', String(parentUserId))
    .where('studentIdNumber', '==', String(studentId))
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (!linkSnap.empty) {
    const token = (linkSnap.docs[0].data() || {}).parentFcmToken;
    if (token) return [token];
  }
  return [];
}

module.exports = { getFcmTokenForUser, getLinkFcmTokens };
