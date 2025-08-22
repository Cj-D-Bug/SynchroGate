// src/models/mongo/Notification.js
import mongoose from "../../config/mongo.js";

const NotificationSchema = new mongoose.Schema(
  {
    recipient: { type: String, required: true }, // could be user ID or phone
    type: { type: String, enum: ["push", "sms"], required: true },
    message: { type: String, required: true },
    status: { type: String, enum: ["sent", "failed", "pending"], default: "pending" },
    metadata: { type: Object },
  },
  { timestamps: true }
);

// Index for quick lookups
NotificationSchema.index({ recipient: 1, createdAt: -1 });

export default mongoose.model("Notification", NotificationSchema);
