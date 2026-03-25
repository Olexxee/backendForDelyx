import logger from "../lib/logger.js";
import mongoose from "mongoose";
import { NotificationTypes } from "../logic/notifications/notificationTypes.js";

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    title: {
      type: String,
    },

    sender: {
      kind: {
        type: String,
        enum: ["User", "Event", "System"],
      },
      item: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "sender.kind",
      },
    },

    type: {
      type: String,
      enum: Object.values(NotificationTypes), // ✅ use shared constants
      required: true,
    },

    message: {
      type: String,
      required: true,
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },

    read: {
      type: Boolean,
      default: false,
    },

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Notification", notificationSchema);
