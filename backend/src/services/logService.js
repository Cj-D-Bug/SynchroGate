// logService.js - Save and retrieve system logs from MongoDB
import { SystemLog } from '../models/mongo/SystemLog.js';

export const saveLog = async (level, message, meta = {}) => {
  try {
    await SystemLog.create({ level, message, meta, timestamp: new Date() });
  } catch (err) {
    console.error('Log saving failed:', err);
  }
};

export const getLogs = async (filter = {}, limit = 50) => {
  return await SystemLog.find(filter).sort({ timestamp: -1 }).limit(limit);
};
