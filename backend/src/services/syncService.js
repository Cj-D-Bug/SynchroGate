// syncService.js - Offline data synchronization
const { firestore } = require('../config/firebase');

exports.syncOfflineData = async (offlineEvents) => {
  try {
    const batch = firestore.batch();
    
    for (let event of offlineEvents) {
      // Save raw event to Firebase for audit
      const arduinoEventRef = firestore.collection('arduinoEvents').doc();
      batch.set(arduinoEventRef, {
        ...event,
        createdAt: new Date()
      });

      // Sync to Firebase Attendance if valid
      const attendanceRef = firestore.collection('attendance').doc();
      batch.set(attendanceRef, {
        studentId: event.studentId,
        status: event.status,
        timestamp: event.timestamp,
        createdAt: new Date()
      });
    }
    
    await batch.commit();
    return { success: true, count: offlineEvents.length };
  } catch (err) {
    console.error('Offline sync failed:', err);
    throw new Error('Offline sync process failed');
  }
};
