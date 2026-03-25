import logger from "../lib/logger.js";
import mongoose from "mongoose";

const helpfulVoteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Post",
      required: true,
    },
    isHelpful: { type: Boolean, required: true },
  },
  { timestamps: true }
);

// Ensure a user can only vote once per post
helpfulVoteSchema.index({ userId: 1, postId: 1 }, { unique: true });

export default mongoose.model("HelpfulVote", helpfulVoteSchema);
