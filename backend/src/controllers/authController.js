const admin = require("firebase-admin");
const sessionService = require("../services/sessionService");

// Firestore reference
const db = admin.firestore();

/**
 * Resolve the users collection document ID for FCM token and profile writes.
 * FCM token must be stored in the document named: parentId (parents), studentId (students), or "Admin"/"Developer".
 */
function getUsersDocId(userData, fallbackDocId) {
  if (!userData) return fallbackDocId;
  const role = String(userData.role || "").toLowerCase();
  if (role === "parent") {
    const pid = userData.parentId || userData.parentIdNumber;
    return pid && String(pid).includes("-") ? String(pid).trim() : (fallbackDocId || pid);
  }
  if (role === "student") {
    const sid = userData.studentId;
    return sid ? String(sid).trim() : fallbackDocId;
  }
  if (role === "admin") return "Admin";
  if (role === "developer") return "Developer";
  return fallbackDocId;
}

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

    // FCM token and user data are stored in the document named parentId (parents) or studentId (students) in users collection
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

    // Set lastLoginAt on registration to mark user as logged in
    userData.lastLoginAt = now;

    // Store FCM token in fcmToken field of user document (if provided)
    const fcmToken = req.body.fcmToken;
    if (fcmToken && typeof fcmToken === 'string' && fcmToken.trim().length > 0) {
      userData.fcmToken = fcmToken.trim();
      userData.pushTokenUpdatedAt = now;
    }

    await userRef.set(userData);

    if (fcmToken && typeof fcmToken === 'string' && fcmToken.trim().length > 0) {
      console.log(`🔔 [FCM] FCM token generated and saved for registered user | users/${documentId} | role: ${role.toLowerCase()} | fullName: ${fullName}`);
    }

    // If role is student, add to students collection and create admin verification alert
    if (role.toLowerCase() === "student") {
      await db.collection("students").doc(studentId).set({
        studentId: studentId,
        fullName,
        qrCode: null,
        parentId: linkedStudents ? linkedStudents[0] : null,
      });

      try {
        // Save notification in admin_alerts collection, document named "inbox"
        const adminAlertsRef = db.collection('admin_alerts').doc('inbox');
        const adminAlertsSnap = await adminAlertsRef.get();
        const existingItems = adminAlertsSnap.exists
          ? (Array.isArray(adminAlertsSnap.data()?.items) ? adminAlertsSnap.data().items : [])
          : [];

        const studentName = fullName || 'Student';
        const verificationAlert = {
          id: `student_verification_${studentId}_${Date.now()}`,
          type: 'student_verification_pending',
          title: 'Student Verification Required',
          message: `${studentName} (${studentId}) has registered and needs verification. Please verify the student account to allow access.`,
          createdAt: new Date().toISOString(),
          status: 'unread',
          studentId: studentId,
          studentName: studentName,
        };

        const updatedItems = [verificationAlert, ...existingItems];
        await adminAlertsRef.set({ items: updatedItems }, { merge: true });
        console.log('✅ [REGISTER] Admin alert created for student verification:', verificationAlert.id);
      } catch (alertError) {
        console.error('❌ [REGISTER] Error creating admin alert for student verification:', alertError);
      }
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
    console.log('🔐 [LOGIN] ========== LOGIN REQUEST RECEIVED ==========');
    const { idToken, fcmToken: bodyFcmToken, deviceModel: bodyDeviceModel } = req.body;
    console.log('🔔 [FCM] Login request fcmToken:', bodyFcmToken ? `received (len ${String(bodyFcmToken).length})` : 'null/absent');
    if (!idToken) {
      console.log('❌ [LOGIN] Missing ID Token');
      return res.status(400).json({ message: "ID Token required" });
    }

    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const uid = decodedToken.uid;
    console.log(`🔐 [LOGIN] Firebase UID verified: ${uid}`);

    // Since we now use parent/student IDs as document names, we need to search by UID first
    const usersRef = db.collection("users");
    const q = usersRef.where("uid", "==", uid);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      console.log(`❌ [LOGIN] User not found for UID: ${uid}`);
      return res.status(404).json({ message: "User not found" });
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    const documentId = userDoc.id;
    const userRole = (userData.role || 'student').toLowerCase();
    const fullName = userData.fullName || 'Unknown';
    
    console.log(`🔐 [LOGIN] User found - ID: ${documentId}, Role: ${userRole}, Name: ${fullName}`);

    // Get device ID from request; optional deviceModel from client for clearer logs/UI
    const deviceId = sessionService.getDeviceId(req);
    const deviceModel = bodyDeviceModel && String(bodyDeviceModel).trim() ? String(bodyDeviceModel).trim().substring(0, 120) : null;
    const deviceLabel = deviceModel ? `${deviceModel} (${deviceId.substring(0, 40)}...)` : deviceId.substring(0, 80) + '...';
    console.log(`🔐 [LOGIN] Device: ${deviceLabel}`);

    // NOTE: We no longer enforce a global \"one user per role\" limit.
    // Only per-account, per-device sessions are enforced below via checkActiveSession().

    const usersDocId = getUsersDocId(userData, documentId);

    // Per-account, per-device session enforcement:
    // - Students/Admins/Developers: one device per account (strict)
    // - Parents: ALLOW multiple devices per account (no SESSION_ACTIVE block)
    if (userRole !== 'parent') {
      const sessionCheck = await sessionService.checkActiveSession(documentId, usersDocId);
      const existingLabel = sessionCheck.existingDeviceModel
        ? `${sessionCheck.existingDeviceModel} (${sessionCheck.existingDeviceId?.substring(0, 40)}...)`
        : (sessionCheck.existingDeviceId ? sessionCheck.existingDeviceId.substring(0, 50) + '...' : 'null');
      const currentLabel = deviceModel ? `${deviceModel} (${deviceId.substring(0, 40)}...)` : deviceId.substring(0, 50) + '...';
      console.log(`🔐 [LOGIN] User session check: hasActiveSession=${sessionCheck.hasActiveSession}, existing=${existingLabel}, current=${currentLabel}`);
      
      if (sessionCheck.hasActiveSession) {
        const sameDeviceId = sessionCheck.existingDeviceId === deviceId;
        // When both session and request have deviceModel, they must match (server-derived deviceId can collide for different devices on same network)
        const existingModel = sessionCheck.existingDeviceModel && String(sessionCheck.existingDeviceModel).trim();
        const currentModel = deviceModel && String(deviceModel).trim();
        const sameDeviceModel = !existingModel || !currentModel ? true : (existingModel === currentModel);
        const sameDevice = sameDeviceId && sameDeviceModel;
        if (sameDevice) {
          // Same device - allow login and update session
          console.log(`✅ [LOGIN] User ${documentId} (${userRole}) logging in from SAME device. Updating session.`);
        } else {
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
          
          const existingDeviceLabel = sessionCheck.existingDeviceModel || sessionCheck.existingDeviceId?.substring(0, 60) + '...';
          const attemptedDeviceLabel = deviceModel || deviceId.substring(0, 60) + '...';
          console.log(`❌ ========== ACCOUNT ALREADY IN ACTIVE SESSION ==========`);
          console.log(`❌ User ID: ${documentId}`);
          console.log(`❌ Name: ${fullName}`);
          console.log(`❌ Role: ${userRole}`);
          console.log(`❌ Active session device: ${existingDeviceLabel}`);
          console.log(`❌ Active session since: ${loginTimeFormatted}`);
          console.log(`❌ Attempted login from device: ${attemptedDeviceLabel}`);
          console.log(`❌ =======================================================`);
          
          return res.status(403).json({ 
            message: "Account is currently in session on another device",
            code: "SESSION_ACTIVE",
            loginTime: loginTimeFormatted,
            activeDeviceModel: sessionCheck.existingDeviceModel || undefined,
          });
        }
      } else {
        console.log(`✅ [LOGIN] No existing session found for user ${documentId}. Allowing new login.`);
      }
    } else {
      console.log(`✅ [LOGIN] Parent account ${documentId} allowed to log in from multiple devices (no per-device limit).`);
    }

    const now = new Date().toISOString();
    const updateData = {
      lastLoginAt: now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    // Store FCM token in fcmToken field of user document (if provided)
    const fcmToken = bodyFcmToken || req.body.fcmToken;
    if (fcmToken && typeof fcmToken === 'string' && fcmToken.trim().length > 0) {
      updateData.fcmToken = fcmToken.trim();
      updateData.pushTokenUpdatedAt = now;
    }

    // Update the user document by name: parentId, studentId, or Admin (where FCM token is stored)
    const userDocRef = db.collection("users").doc(usersDocId);
    // Ensure canonical Admin doc always has correct role/uid for push login checks
    if (userRole === 'admin') {
      updateData.role = 'admin';
      updateData.uid = userData.uid || uid;
    }
    await userDocRef.set(updateData, { merge: true });

    if (fcmToken && typeof fcmToken === 'string' && fcmToken.trim().length > 0) {
      console.log(`🔔 [FCM] FCM token generated and saved for logged-in user | users/${usersDocId} | role: ${userRole} | fullName: ${fullName}`);
    } else {
      console.log(`⚠️ [FCM] Login successful but no FCM token received from client | users/${usersDocId} | role: ${userRole} | (client may be Expo Go or token generation failed)`);
    }

    // Create or update session for this device (include role and optional device model)
    await sessionService.createSession(documentId, deviceId, userRole, deviceModel);
    console.log(`✅ [LOGIN] Session created/updated for user ${documentId} (role: ${userRole}) on device ${deviceLabel}`);

    // Get updated user data
    const updatedUserDoc = await userDocRef.get();
    const updatedUserData = updatedUserDoc.data();

    console.log(`✅ ========== LOGGED IN SUCCESSFUL ==========`);
    console.log(`✅ User ID: ${documentId}`);
    console.log(`✅ Name: ${fullName}`);
    console.log(`✅ Role: ${userRole}`);
    console.log(`✅ Device: ${deviceLabel}`);
    console.log(`✅ ==========================================`);
    
    res.json({
      message: "Login successful",
      user: updatedUserData,
    });
  } catch (err) {
    console.error("❌ [LOGIN ERROR]:", err);
    console.error("❌ [LOGIN ERROR] Stack:", err.stack);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== LOGOUT =====
exports.logout = async (req, res) => {
  try {
    console.log('🔓 [LOGOUT] ========== LOGOUT REQUEST RECEIVED ==========');
    const uid = req.user.uid; // Comes from authMiddleware
    console.log(`🔓 [LOGOUT] Firebase UID: ${uid}`);
    
    // Since we now use parent/student IDs as document names, we need to search by UID first
    const usersRef = db.collection("users");
    const q = usersRef.where("uid", "==", uid);
    const querySnapshot = await q.get();

    if (querySnapshot.empty) {
      console.log(`❌ [LOGOUT] User not found for UID: ${uid}`);
      return res.status(404).json({ message: "User not found" });
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();
    const documentId = userDoc.id;
    const userRole = (userData.role || 'student').toLowerCase();
    const fullName = userData.fullName || 'Unknown';
    
    console.log(`🔓 [LOGOUT] User found - ID: ${documentId}, Role: ${userRole}, Name: ${fullName}`);

    // Delete the session
    await sessionService.deleteSession(documentId);

    // Clear login timestamp and FCM token from the document named parentId/studentId/Admin
    const usersDocId = getUsersDocId(userData, documentId);
    try {
      await db.collection("users").doc(usersDocId).update({
        lastLoginAt: admin.firestore.FieldValue.delete(),
        fcmToken: admin.firestore.FieldValue.delete(),
        pushTokenUpdatedAt: admin.firestore.FieldValue.delete(),
      });
      console.log(`✅ [LOGOUT] lastLoginAt and FCM token cleared for user ${usersDocId}`);
    } catch (clearErr) {
      console.warn('⚠️ [LOGOUT] Failed to clear FCM token (non-blocking):', clearErr?.message);
    }

    console.log(`✅ ========== LOGGED OUT SUCCESSFULLY ==========`);
    console.log(`✅ Student ID: ${documentId}`);
    console.log(`✅ Name: ${fullName}`);
    console.log(`✅ Role: ${userRole}`);
    console.log(`✅ =============================================`);

    res.json({ message: "Logout successful" });
  } catch (err) {
    console.error("❌ [LOGOUT ERROR]:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// ===== UPDATE FCM TOKEN =====
exports.updateFcmToken = async (req, res) => {
  try {
    const uid = req.user.uid;
    const { fcmToken } = req.body;
    if (!fcmToken || typeof fcmToken !== 'string' || fcmToken.trim().length === 0) {
      return res.status(400).json({ message: 'FCM token is required' });
    }
    const usersRef = db.collection('users');
    const q = usersRef.where('uid', '==', uid);
    const snapshot = await q.get();
    if (snapshot.empty) {
      return res.status(404).json({ message: 'User not found' });
    }
    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();
    const documentId = userDoc.id;
    // Save FCM token in the document named parentId, studentId, or Admin
    const usersDocId = getUsersDocId(userData, documentId);
    const docRef = db.collection('users').doc(usersDocId);
    const now = new Date().toISOString();
    await docRef.update({
      fcmToken: fcmToken.trim(),
      pushTokenUpdatedAt: now,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    const fullName = userData.fullName || userData.firstName || 'Unknown';
    const userRole = (userData.role || 'student').toLowerCase();
    console.log(`🔔 [FCM] FCM token generated and saved for logged-in user | users/${usersDocId} | role: ${userRole} | fullName: ${fullName}`);
    return res.json({ message: 'FCM token updated' });
  } catch (err) {
    console.error('Update FCM token error:', err);
    return res.status(500).json({ error: 'Server error' });
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
