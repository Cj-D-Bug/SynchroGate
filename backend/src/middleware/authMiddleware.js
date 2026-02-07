const admin = require("firebase-admin");
const path = require("path");
const sessionService = require("../services/sessionService");

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
    let documentId = null;
    try {
      const users = await db.collection('users').where('uid', '==', decodedToken.uid).limit(1).get();
      if (!users.empty) {
        const userDoc = users.docs[0];
        const data = userDoc.data();
        documentId = userDoc.id;
        if (data && typeof data.role === 'string') role = data.role.toLowerCase();
      }
    } catch {}

    // Verify session is valid (user is logged in on this device)
    // Note: Login endpoint doesn't use this middleware, so session check happens in login controller
    if (documentId) {
      const deviceId = sessionService.getDeviceId(req);
      const sessionCheck = await sessionService.checkActiveSession(documentId);
      
      if (!sessionCheck.hasActiveSession) {
        // No active session - user needs to login
        console.log(`⚠️ No active session found for user ${documentId}`);
        return res.status(401).json({ 
          message: "Unauthorized: No active session. Please log in again." 
        });
      }
      
      if (sessionCheck.existingDeviceId !== deviceId) {
        // User is trying to access from a different device than the one they're logged in on
        console.log(`⚠️ Unauthorized access attempt: User ${documentId} trying to access from device ${deviceId}, but logged in on ${sessionCheck.existingDeviceId}`);
        return res.status(401).json({ 
          message: "Unauthorized: You are logged in on another device. Please log out from that device first." 
        });
      }

      // Update session activity on valid request
      await sessionService.updateActivity(documentId);
    }

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role,
      documentId, // Add documentId for session management
    };

    next();
  } catch (err) {
    console.error("🔥 Firebase token verification failed:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
