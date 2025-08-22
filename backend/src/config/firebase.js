const admin = require('firebase-admin');
const { env } = require('./env');

const serviceAccount = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: env.FIREBASE_DATABASE_URL,
});

const firestore = admin.firestore();
const realtimeDB = admin.database();

module.exports = { admin, firestore, realtimeDB };
