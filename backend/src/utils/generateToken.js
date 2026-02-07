// src/utils/generateToken.js
const admin = require("firebase-admin");

/**
 * Generate a Firebase custom token
 * @param {string} uid - Firebase UID
 * @returns {Promise<string>} Firebase custom token
 */
const generateToken = async (uid) => {
  try {
    return await admin.auth().createCustomToken(uid);
  } catch (err) {
    throw new Error("Error generating Firebase token: " + err.message);
  }
};

/**
 * Validate a Firebase ID token
 * @param {string} token - Firebase ID token
 * @returns {Promise<object>} Decoded user info
 */
const validateToken = async (token) => {
  try {
    return await admin.auth().verifyIdToken(token);
  } catch (err) {
    throw new Error("Invalid or expired Firebase token");
  }
};

module.exports = { generateToken, validateToken };
