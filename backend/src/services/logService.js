// logService.js - Save and retrieve system logs from Firebase
const { firestore } = require('../config/firebase');

exports.saveLog = async (level, message, meta = {}) => {
  try {
    await firestore.collection('systemLogs').add({
      level,
      message,
      meta,
      timestamp: new Date(),
      createdAt: new Date()
    });
  } catch (err) {
    console.error('Log saving failed:', err);
  }
};

exports.getLogs = async (filter = {}, limit = 50) => {
  try {
    let query = firestore.collection('systemLogs')
      .orderBy('timestamp', 'desc')
      .limit(limit);
    
    // Apply filters if provided
    if (filter.level) {
      query = query.where('level', '==', filter.level);
    }
    
    const snapshot = await query.get();
    const logs = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    
    return logs;
  } catch (err) {
    console.error('Error fetching logs:', err);
    return [];
  }
};
