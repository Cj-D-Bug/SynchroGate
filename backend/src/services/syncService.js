// syncService.js - Offline data synchronization
import { Attendance } from '../models/mysql/Attendance.js';
import { ArduinoEvent } from '../models/mongo/ArduinoEvent.js';

export const syncOfflineData = async (offlineEvents) => {
  try {
    for (let event of offlineEvents) {
      // Save raw event to MongoDB for audit
      await ArduinoEvent.create(event);

      // Sync to MySQL Attendance if valid
      await Attendance.create({
        studentId: event.studentId,
        status: event.status,
        timestamp: event.timestamp
      });
    }
    return { success: true, count: offlineEvents.length };
  } catch (err) {
    console.error('Offline sync failed:', err);
    throw new Error('Offline sync process failed');
  }
};
