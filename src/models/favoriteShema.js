import mongoose from "mongoose";

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    postId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    postType: {
      type: String,
      enum: ["ask", "event", "mart", "post"],
      required: true,
    },
  },
  { timestamps: true }
);

// Ensure a user can only favorite a post once
favoriteSchema.index({ userId: 1, postId: 1, postType: 1 }, { unique: true });

// Safe export to prevent OverwriteModelError
export const Favorite =
  mongoose.models.Favorite || mongoose.model("Favorite", favoriteSchema);
