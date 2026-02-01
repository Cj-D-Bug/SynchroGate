const { firestore } = require("../config/firebase");

exports.getLogs = async (req, res) => {
  try {
    const logsSnapshot = await firestore.collection('systemLogs')
      .orderBy('createdAt', 'desc')
      .get();
    
    const logs = [];
    logsSnapshot.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getArduinoEvents = async (req, res) => {
  try {
    const eventsSnapshot = await firestore.collection('arduinoEvents')
      .orderBy('createdAt', 'desc')
      .get();
    
    const events = [];
    eventsSnapshot.forEach(doc => {
      events.push({ id: doc.id, ...doc.data() });
    });
    
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
