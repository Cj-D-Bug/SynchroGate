// src/controllers/attendanceController.js
import { firestore } from '../config/firebase.js'; // your Firebase admin SDK import

const attendanceCollection = firestore.collection('attendance');

export const checkIn = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const record = {
      studentId,
      type: 'IN',
      timestamp: new Date().toISOString(),
    };

    const docRef = await attendanceCollection.add(record);

    res.status(201).json({ id: docRef.id, ...record });
  } catch (err) {
    console.error('Check-in error:', err);
    res.status(500).json({ error: 'Failed to check in' });
  }
};

export const checkOut = async (req, res) => {
  try {
    const { studentId } = req.body;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId is required' });
    }

    const record = {
      studentId,
      type: 'OUT',
      timestamp: new Date().toISOString(),
    };

    const docRef = await attendanceCollection.add(record);

    res.status(201).json({ id: docRef.id, ...record });
  } catch (err) {
    console.error('Check-out error:', err);
    res.status(500).json({ error: 'Failed to check out' });
  }
};

export const getLogs = async (req, res) => {
  try {
    const { studentId } = req.params;
    if (!studentId) {
      return res.status(400).json({ error: 'studentId parameter required' });
    }

    const snapshot = await attendanceCollection
      .where('studentId', '==', studentId)
      .orderBy('timestamp', 'desc')
      .get();

    const logs = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });

    res.json(logs);
  } catch (err) {
    console.error('Get logs error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance logs' });
  }
};
