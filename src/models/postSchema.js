import logger from "../lib/logger.js";
import mongoose from "mongoose";

const TimelinePostSchema = new mongoose.Schema(
  {
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String, default: "" },
    media: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }],
    visibility: {
      type: String,
      enum: ["public", "connections", "private"],
      default: "public",
    },
    tags: [{ type: String }],
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    authorVerified: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

TimelinePostSchema.index({ createdAt: -1 });
TimelinePostSchema.index({ author: 1, createdAt: -1 });
TimelinePostSchema.index({ visibility: 1, createdAt: -1 });

export default mongoose.model("TimelinePost", TimelinePostSchema);
