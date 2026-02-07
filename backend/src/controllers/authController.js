const admin = require("firebase-admin");
const sessionService = require("../services/sessionService");

// Firestore reference
const db = admin.firestore();

// ===== REGISTER =====
exports.register = async (req, res) => {
  const { uid, fullName, email, role, linkedStudents, parentId, studentId, fcmToken } = req.body;

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

    const now = new Date().toISOString();
    const userData = {
      uid,
      fullName,
      email,
      role: role.toLowerCase(),
      linkedStudents: linkedStudents || [],
      parentId: role.toLowerCase() === "parent" ? parentId : null,
      studentId: role.toLowerCase() === "student" ? studentId : null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Add FCM token if provided
    if (fcmToken && typeof fcmToken === 'string' && fcmToken.trim().length > 0) {
      userData.fcmToken = fcmToken.trim();
      userData.pushTokenType = 'fcm';
      userData.pushTokenUpdatedAt = now;
      // CRITICAL: Set lastLoginAt on registration to mark user as logged in
      userData.lastLoginAt = now;
      console.log(`✅ FCM token saved during registration for ${role} ${documentId}`);
    }

    await userRef.set(userData);

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
    const { idToken, fcmToken } = req.body;
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
    const documentId = userDoc.id;
    const userRole = (userData.role || 'student').toLowerCase();

    // Get device ID from request
    const deviceId = sessionService.getDeviceId(req);

    // Check if there's an active session for this role (from a different user)
    const roleSessionCheck = await sessionService.checkActiveSessionByRole(userRole);
    
    if (roleSessionCheck.hasActiveSession && roleSessionCheck.existingUserId !== documentId) {
      // Another user with the same role is already logged in
      console.log(`⚠️ Role ${userRole} already has an active session for user ${roleSessionCheck.existingUserId}. Invalidating to allow login for user ${documentId}`);
      await sessionService.invalidateSession(roleSessionCheck.existingUserId);
    }

    // Check if user has an active session on a different device
    const sessionCheck = await sessionService.checkActiveSession(documentId);
    
    if (sessionCheck.hasActiveSession && sessionCheck.existingDeviceId !== deviceId) {
      // User is trying to login from a different device
      // Reject the login attempt and return error
      let loginTimeFormatted = 'unknown time';
      try {
        const loginTime = sessionCheck.loginTime;
        if (loginTime) {
          // Handle Firestore Timestamp
          if (loginTime.toDate && typeof loginTime.toDate === 'function') {
            loginTimeFormatted = loginTime.toDate().toLocaleString();
          } else if (loginTime._seconds) {
            // Firestore Timestamp with _seconds property
            loginTimeFormatted = new Date(loginTime._seconds * 1000).toLocaleString();
          } else {
            // Regular date or ISO string
            loginTimeFormatted = new Date(loginTime).toLocaleString();
          }
        }
      } catch (timeError) {
        console.warn('Error formatting login time:', timeError);
      }
      
      console.log(`⚠️ User ${documentId} attempting to login from new device. Rejecting login - active session exists on device ${sessionCheck.existingDeviceId} since ${loginTimeFormatted}`);
      return res.status(403).json({ 
        message: "Account is currently in session on another device",
        code: "SESSION_ACTIVE",
        loginTime: loginTimeFormatted
      });
    }

    // Update FCM token and lastLoginAt if provided
    const now = new Date().toISOString();
    const updateData = {
      lastLoginAt: now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Update FCM token if provided
    if (fcmToken && typeof fcmToken === 'string' && fcmToken.trim().length > 0) {
      updateData.fcmToken = fcmToken.trim();
      updateData.pushTokenType = 'fcm';
      updateData.pushTokenUpdatedAt = now;
      console.log(`✅ FCM token updated during login for user ${documentId}`);
    }

    // Update the user document with login timestamp and FCM token
    const userDocRef = db.collection("users").doc(documentId);
    await userDocRef.update(updateData);

    // Create or update session for this device (include role)
    await sessionService.createSession(documentId, deviceId, userRole);

    // Get updated user data
    const updatedUserDoc = await userDocRef.get();
    const updatedUserData = updatedUserDoc.data();

    res.json({
      message: "Login successful",
      user: updatedUserData,
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== LOGOUT =====
exports.logout = async (req, res) => {
  try {
    const uid = req.user.uid; // Comes from authMiddleware
    
    // Since we now use parent/student IDs as document names, we need to search by UID first
    const usersRef = db.collection("users");
    const q = usersRef.where("uid", "==", uid);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      return res.status(404).json({ message: "User not found" });
    }

    const userDoc = querySnapshot.docs[0];
    const documentId = userDoc.id;

    // Delete the session
    await sessionService.deleteSession(documentId);

    res.json({ message: "Logout successful" });
  } catch (err) {
    console.error("Logout Error:", err);
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
    const documentId = userDoc.id;

    // Update session activity on profile access
    await sessionService.updateActivity(documentId);

    res.json(userData);
  } catch (err) {
    console.error("Get Profile Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};
