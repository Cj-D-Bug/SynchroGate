const { firestore } = require("../config/firebase");

exports.getSchedules = async (req, res) => {
  try {
    const schedulesSnapshot = await firestore.collection('schedules').get();
    const schedules = [];
    
    schedulesSnapshot.forEach(doc => {
      schedules.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createSchedule = async (req, res) => {
  try {
    const scheduleData = {
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const docRef = await firestore.collection('schedules').add(scheduleData);
    res.status(201).json({ id: docRef.id, ...scheduleData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
