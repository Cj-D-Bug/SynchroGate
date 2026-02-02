const admin = require("firebase-admin");
const path = require("path");

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  const serviceAccountPath = path.resolve(__dirname, "../config/firebaseServiceAccount.json");

  try {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log("✅ Firebase Admin initialized successfully");
  } catch (err) {
    console.error("❌ Failed to initialize Firebase Admin:", err.message);
    throw new Error("Firebase Admin initialization failed");
  }
}

/**
 * Firebase Authentication Middleware
 * Verifies Firebase ID token from Authorization header
 *
 * IMPORTANT for admin limit logic:
 * - If no user document is found by uid, we also check special docs:
 *   "Developer" and "Admin" in the users collection, matching by email.
 * - This ensures legacy Admin/Developer accounts (created by scripts)
 *   are still recognized as admin/developer even if they were missing uid.
 */
module.exports = async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Authorization token missing" });
    }

    const token = authHeader.split(" ")[1];

    // Verify token via Firebase Admin
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Fetch user profile to determine role
    const db = admin.firestore();
    let role = 'student';

    try {
      // First, try to find a standard user document by uid
      const users = await db.collection('users').where('uid', '==', decodedToken.uid).limit(1).get();
      if (!users.empty) {
        const data = users.docs[0].data() || {};
        if (data && typeof data.role === 'string') {
          role = String(data.role).toLowerCase();
        }
      } else {
        // No user by uid - check for special Admin / Developer docs
        const email = String(decodedToken.email || '').toLowerCase();

        // Check Developer doc
        try {
          const devSnap = await db.collection('users').doc('Developer').get();
          if (devSnap.exists) {
            const devData = devSnap.data() || {};
            const devEmail = String(devData.email || devData.Email || '').toLowerCase();
            if (devEmail && devEmail === email) {
              role = 'developer';
            }
          }
        } catch {}

        // Check Admin doc if still not resolved
        if (role === 'student') {
          try {
            const adminSnap = await db.collection('users').doc('Admin').get();
            if (adminSnap.exists) {
              const adminData = adminSnap.data() || {};
              const adminEmail = String(adminData.email || adminData.Email || '').toLowerCase();
              if (adminEmail && adminEmail === email) {
                role = 'admin';
              }
            }
          } catch {}
        }
      }
    } catch (lookupError) {
      console.warn('authMiddleware user lookup error (non-critical):', lookupError?.message || lookupError);
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role,
    };

    next();
  } catch (err) {
    console.error("🔥 Firebase token verification failed:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
