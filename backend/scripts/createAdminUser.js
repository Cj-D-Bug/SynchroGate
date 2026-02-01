import { admin, firestore } from "../src/config/firebase.js";

async function ensureAdminUser() {
  const email = "admin123@gmail.com";
  const password = "awds1234";
  const userDocId = "Admin"; // Firestore document ID

  try {
    // Ensure Auth user exists (create or update password)
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().updateUser(userRecord.uid, { password });
    } catch (err) {
      if (err && err.code === "auth/user-not-found") {
        userRecord = await admin.auth().createUser({ email, password, emailVerified: true, disabled: false });
      } else {
        throw err;
      }
    }

    // Optionally set custom claims for role
    const currentClaims = (await admin.auth().getUser(userRecord.uid)).customClaims || {};
    if (currentClaims.role !== "Admin") {
      await admin.auth().setCustomUserClaims(userRecord.uid, { ...currentClaims, role: "Admin" });
    }

    // Upsert Firestore doc with ID "Admin"
    const userData = {
      email: "admin123@gmail.com",
      fName: "Admin",
      lName: "User",
      role: "Admin",
    };
    await firestore.collection("users").doc(userDocId).set(userData, { merge: true });

    console.log("✅ Admin user ensured in Auth and Firestore document 'Admin' created/updated.");
  } catch (error) {
    console.error("❌ Failed to create Admin user:", error);
    process.exitCode = 1;
  }
}

ensureAdminUser().then(() => process.exit());


