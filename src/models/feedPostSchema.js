import mongoose from "mongoose";
const { Schema, model } = mongoose;

const FEED_POST_CONTEXT_TYPES = ["general", "group", "tournament", "match"];
const FEED_POST_VISIBILITY = [
  "public",
  "group_members",
  "tournament_participants",
  "private",
];
const FEED_POST_STATUS = ["active", "hidden", "deleted", "flagged"];

const FeedPostSchema = new Schema(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    content: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },

    media: [
      {
        type: Schema.Types.ObjectId,
        ref: "Media",
      },
    ],

    contextType: {
      type: String,
      enum: FEED_POST_CONTEXT_TYPES,
      default: "general",
      required: true,
      index: true,
    },

    contextId: {
      type: Schema.Types.ObjectId,
      default: null,
      index: true,
    },

    visibility: {
      type: String,
      enum: FEED_POST_VISIBILITY,
      default: "public",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: FEED_POST_STATUS,
      default: "active",
      required: true,
      index: true,
    },

    reactionsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    commentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    isPinned: {
      type: Boolean,
      default: false,
      index: true,
    },

    isFeatured: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

FeedPostSchema.index({ createdAt: -1 });
FeedPostSchema.index({ author: 1, createdAt: -1 });
FeedPostSchema.index({ contextType: 1, contextId: 1, createdAt: -1 });
FeedPostSchema.index({ visibility: 1, status: 1, createdAt: -1 });
FeedPostSchema.index({ status: 1, createdAt: -1 });

export default model("FeedPost", FeedPostSchema);
