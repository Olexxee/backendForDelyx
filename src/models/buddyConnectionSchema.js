import logger from "../lib/logger.js";
import { Schema, model } from "mongoose";

const BuddyConnectionSchema = new Schema(
  {
    requester: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    recipient: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["pending", "accepted", "declined","none","blocked"],
      default: "pending",
    },
    matchedAt: {
      type: Date,
    },
    matchScore: Number,
    matchReason: String,
    expiresAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

// Prevent duplicate requests (requester <-> recipient in any order)
BuddyConnectionSchema.index({ requester: 1, recipient: 1 }, { unique: true });

export default model("BuddyConnection", BuddyConnectionSchema);
