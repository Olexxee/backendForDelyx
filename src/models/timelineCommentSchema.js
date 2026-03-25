import logger from "../lib/logger.js";
import mongoose from "mongoose";

const TimelineCommentSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TimelinePost",
      required: true,
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String, required: true },
    media: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }],
    parentComment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "TimelineComment",
      default: null,
    },
    likesCount: { type: Number, default: 0 },
    authorVerified: { type: Boolean, default: false },
  },
  { timestamps: true }
);

TimelineCommentSchema.index({ post: 1, createdAt: -1 });
TimelineCommentSchema.index({ parentComment: 1 });

export default mongoose.model("TimelineComment", TimelineCommentSchema);
