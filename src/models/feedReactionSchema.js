import mongoose from "mongoose";

const { Schema, model } = mongoose;

const FEED_REACTION_TARGET_TYPES = ["post", "comment"];
const FEED_REACTION_TYPES = ["like"];

const FeedReactionSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    targetType: {
      type: String,
      enum: FEED_REACTION_TARGET_TYPES,
      required: true,
      index: true,
    },

    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    reactionType: {
      type: String,
      enum: FEED_REACTION_TYPES,
      default: "like",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

FeedReactionSchema.index(
  { user: 1, targetType: 1, targetId: 1 },
  { unique: true },
);

FeedReactionSchema.index({ targetType: 1, targetId: 1 });

export default model("FeedReaction", FeedReactionSchema);
