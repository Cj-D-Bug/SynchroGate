const SystemLog = require("../models/mongo/SystemLog");
const ArduinoEvent = require("../models/mongo/ArduinoEvent");

exports.getLogs = async (req, res) => {
  try {
    const logs = await SystemLog.find().sort({ createdAt: -1 });
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getArduinoEvents = async (req, res) => {
  try {
    const events = await ArduinoEvent.find().sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
