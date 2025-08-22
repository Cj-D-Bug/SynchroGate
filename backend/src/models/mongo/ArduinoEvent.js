// src/models/mongo/ArduinoEvent.js
import mongoose from "../../config/mongo.js";

const ArduinoEventSchema = new mongoose.Schema(
  {
    rfidTag: { type: String, required: true },
    eventType: { type: String, enum: ["checkin", "checkout"], required: true },
    rawData: { type: Object },
  },
  { timestamps: true }
);

ArduinoEventSchema.index({ rfidTag: 1, createdAt: -1 });

export default mongoose.model("ArduinoEvent", ArduinoEventSchema);
