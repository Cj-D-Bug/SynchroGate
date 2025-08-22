const admin = require("firebase-admin");

// Firestore reference
const db = admin.firestore();

// ===== REGISTER =====
exports.register = async (req, res) => {
  const { uid, fullName, email, role, linkedStudents } = req.body;

  try {
    if (!uid || !fullName || !email || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (role.toLowerCase() === "admin") {
      return res.status(403).json({ message: "Admin accounts cannot be self-registered" });
    }

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
      return res.status(400).json({ message: "User already exists" });
    }

    await userRef.set({
      uid,
      fullName,
      email,
      role: role.toLowerCase(),
      linkedStudents: linkedStudents || [],
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // If role is student, add to students collection
    if (role.toLowerCase() === "student") {
      await db.collection("students").doc(uid).set({
        studentId: uid,
        fullName,
        qrCode: null,
        parentId: linkedStudents ? linkedStudents[0] : null,
      });
    }

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Register Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== LOGIN =====
// Since Firebase client handles login, backend verifies ID token
exports.login = async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ message: "ID Token required" });

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;

    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return res.status(404).json({ message: "User not found" });

    res.json({
      message: "Login successful",
      user: userDoc.data(),
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== GET PROFILE =====
exports.getProfile = async (req, res) => {
  try {
    const uid = req.user.uid; // Comes from authMiddleware
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) return res.status(404).json({ message: "User not found" });

    res.json(userDoc.data());
  } catch (err) {
    console.error("Get Profile Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
