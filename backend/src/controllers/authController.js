const admin = require("firebase-admin");

// Firestore reference
const db = admin.firestore();

// ===== REGISTER =====
exports.register = async (req, res) => {
  const { uid, fullName, email, role, linkedStudents, parentId, studentId } = req.body;

  try {
    if (!uid || !fullName || !email || !role) {
      return res.status(400).json({ message: "All fields are required" });
    }

    if (role.toLowerCase() === "admin") {
      return res.status(403).json({ message: "Admin accounts cannot be self-registered" });
    }

    // Use parent/student ID as document name instead of Firebase UID
    const documentId = role.toLowerCase() === "parent" ? parentId : studentId;
    
    if (!documentId) {
      return res.status(400).json({ message: "Parent ID or Student ID is required" });
    }

    const userRef = db.collection("users").doc(documentId);
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
      parentId: role.toLowerCase() === "parent" ? parentId : null,
      studentId: role.toLowerCase() === "student" ? studentId : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // If role is student, add to students collection
    if (role.toLowerCase() === "student") {
      await db.collection("students").doc(studentId).set({
        studentId: studentId,
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

    // Since we now use parent/student IDs as document names, we need to search by UID first
    const usersRef = db.collection("users");
    const q = usersRef.where("uid", "==", uid);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) return res.status(404).json({ message: "User not found" });

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    res.json({
      message: "Login successful",
      user: userData,
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
    
    // Since we now use parent/student IDs as document names, we need to search by UID first
    const usersRef = db.collection("users");
    const q = usersRef.where("uid", "==", uid);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) return res.status(404).json({ message: "User not found" });

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    res.json(userData);
  } catch (err) {
    console.error("Get Profile Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
