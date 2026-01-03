const admin = require('firebase-admin');
const { env } = require('./env');

let serviceAccount;
try {
  serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);
  console.log('✅ Firebase service account parsed successfully');
} catch (error) {
  console.error('❌ Failed to parse FIREBASE_SERVICE_ACCOUNT_JSON');
  console.error('Make sure it is valid JSON string in Railway variables');
  throw error;
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: env.FIREBASE_DATABASE_URL,
});

const firestore = admin.firestore();
const realtimeDB = admin.database();

module.exports = { admin, firestore, realtimeDB };
