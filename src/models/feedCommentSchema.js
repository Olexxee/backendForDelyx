import mongoose from "mongoose";

const { Schema, model } = mongoose;

const FEED_COMMENT_STATUS = ["active", "hidden", "deleted", "flagged"];

const FeedCommentSchema = new Schema(
  {
    post: {
      type: Schema.Types.ObjectId,
      ref: "FeedPost",
      required: true,
      index: true,
    },

    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    content: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000,
    },

    parentComment: {
      type: Schema.Types.ObjectId,
      ref: "FeedComment",
      default: null,
      index: true,
    },

    status: {
      type: String,
      enum: FEED_COMMENT_STATUS,
      default: "active",
      required: true,
      index: true,
    },

    reactionsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

FeedCommentSchema.index({ post: 1, parentComment: 1, createdAt: -1 });
FeedCommentSchema.index({ parentComment: 1, createdAt: 1 });
FeedCommentSchema.index({ author: 1, createdAt: -1 });
FeedCommentSchema.index({ status: 1, createdAt: -1 });

export default model("FeedComment", FeedCommentSchema);
