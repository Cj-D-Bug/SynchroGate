// src/models/mongo/SystemLog.js
import mongoose from "../../config/mongo.js";

const SystemLogSchema = new mongoose.Schema(
  {
    level: { type: String, enum: ["info", "warn", "error"], default: "info" },
    message: { type: String, required: true },
    context: { type: Object },
  },
  { timestamps: true }
);

SystemLogSchema.index({ level: 1, createdAt: -1 });

export default mongoose.model("SystemLog", SystemLogSchema);
