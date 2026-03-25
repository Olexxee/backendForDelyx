import logger from "../lib/logger.js";
import mongoose from "mongoose";

const TimelineReactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["post", "comment"], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    type: { type: String, enum: ["like"], default: "like" },
  },
  { timestamps: true }
);

TimelineReactionSchema.index(
  { user: 1, targetType: 1, targetId: 1 },
  { unique: true }
);

export default mongoose.model("TimelineReaction", TimelineReactionSchema);
