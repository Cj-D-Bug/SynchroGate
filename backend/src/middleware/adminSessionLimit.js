// src/middleware/adminSessionLimit.js
const { firestore } = require('../config/firebase');

// Maximum number of admins that can be "logged in" (active) at the same time
const MAX_ACTIVE_ADMINS = 3;

/**
 * Middleware to enforce a limit on concurrently logged-in admin accounts.
 *
 * How it works:
 * - Uses the `users` collection in Firestore.
 * - Treats any user with role `admin` (case-insensitive) and a non-null `lastLoginAt`
 *   as an "active" admin session.
 * - Allows up to MAX_ACTIVE_ADMINS active admins.
 * - If the limit is reached and the current admin is NOT already one of the
 *   active admins, requests are rejected with HTTP 429.
 *
 * Notes:
 * - `lastLoginAt` is set on login by the mobile app (via pushTokenGenerator)
 *   and cleared on logout by AuthContext.logout().
 * - This runs on every admin API request, so Railway/backend enforces the rule.
 */
module.exports = async function adminSessionLimit(req, res, next) {
  try {
    // Only enforce for authenticated admins
    const role = req.user && req.user.role ? String(req.user.role).toLowerCase() : null;
    const uid = req.user && req.user.uid ? String(req.user.uid) : null;

    if (!role || role !== 'admin' || !uid) {
      return next();
    }

    // Fetch all admin users (role 'admin' or 'Admin') and determine which are active
    const snapshot = await firestore
      .collection('users')
      .where('role', 'in', ['admin', 'Admin'])
      .get();

    const activeAdmins = [];

    snapshot.forEach((doc) => {
      const data = doc.data() || {};
      const lastLoginAt = data.lastLoginAt;

      if (!lastLoginAt) return;

      // lastLoginAt may be stored as ISO string or Firestore Timestamp
      let lastLoginMs = null;
      if (typeof lastLoginAt === 'string') {
        const parsed = Date.parse(lastLoginAt);
        if (!Number.isNaN(parsed)) lastLoginMs = parsed;
      } else if (lastLoginAt && typeof lastLoginAt.toDate === 'function') {
        lastLoginMs = lastLoginAt.toDate().getTime();
      }

      if (!lastLoginMs) return;

      activeAdmins.push({
        id: doc.id,
        uid: data.uid || null,
        lastLoginAt: lastLoginMs,
      });
    });

    const isCurrentAdminAlreadyActive = activeAdmins.some(
      (admin) => admin.uid && String(admin.uid) === uid
    );

    if (activeAdmins.length >= MAX_ACTIVE_ADMINS && !isCurrentAdminAlreadyActive) {
      console.warn(
        '🚫 Admin login limit reached. Blocking admin request.',
        JSON.stringify({
          max: MAX_ACTIVE_ADMINS,
          activeCount: activeAdmins.length,
          requestingUid: uid,
        })
      );

      return res.status(429).json({
        message:
          'Admin login limit reached. Only 3 admin accounts can be logged in at the same time. Please log out another admin first.',
      });
    }

    return next();
  } catch (error) {
    console.error('Error enforcing admin session limit:', error);
    return res
      .status(500)
      .json({ message: 'Server error while enforcing admin login limit' });
  }
};


