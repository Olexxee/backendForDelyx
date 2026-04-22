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
    },

    contextId: {
      type: Schema.Types.ObjectId,
      default: null,
    },

    visibility: {
      type: String,
      enum: FEED_POST_VISIBILITY,
      default: "public",
      required: true,
    },

    status: {
      type: String,
      enum: FEED_POST_STATUS,
      default: "active",
      required: true,
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
    },

    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

// Enforce model-level integrity for content/media
FeedPostSchema.pre("validate", function (next) {
  const normalizedContent =
    typeof this.content === "string" ? this.content.trim() : "";
  const normalizedMedia = Array.isArray(this.media)
    ? this.media.filter(Boolean)
    : [];

  if (!normalizedContent && normalizedMedia.length === 0) {
    return next(
      new Error("A post must contain content or at least one media item."),
    );
  }

  if (this.contextType !== "general" && !this.contextId) {
    return next(
      new Error("contextId is required when contextType is not 'general'."),
    );
  }

  if (this.contextType === "general" && this.contextId) {
    return next(
      new Error("contextId must be null when contextType is 'general'."),
    );
  }

  if (this.visibility === "group_members" && this.contextType !== "group") {
    return next(
      new Error("visibility 'group_members' requires group context."),
    );
  }

  if (
    this.visibility === "tournament_participants" &&
    this.contextType !== "tournament"
  ) {
    return next(
      new Error(
        "visibility 'tournament_participants' requires tournament context.",
      ),
    );
  }

  return next();
});

// Query-oriented compound indexes
FeedPostSchema.index({ createdAt: -1 });
FeedPostSchema.index({ author: 1, status: 1, createdAt: -1 });
FeedPostSchema.index({
  contextType: 1,
  contextId: 1,
  status: 1,
  createdAt: -1,
});
FeedPostSchema.index({ visibility: 1, status: 1, createdAt: -1 });
FeedPostSchema.index({
  contextType: 1,
  contextId: 1,
  isPinned: 1,
  createdAt: -1,
});
FeedPostSchema.index({
  contextType: 1,
  contextId: 1,
  isFeatured: 1,
  createdAt: -1,
});

export default model("FeedPost", FeedPostSchema);
