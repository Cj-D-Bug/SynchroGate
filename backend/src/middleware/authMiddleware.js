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

    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || "student", // default role if not set
    };

    next();
  } catch (err) {
    console.error("🔥 Firebase token verification failed:", err.message);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
