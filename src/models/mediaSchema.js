import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["profile", "chat", "group", "post", "catalog", "store", "ask", "timeline"],
      required: true,
    },

    url: {
      type: String,
      required: true,
    },

    role: {
      type: String,
      enum: ["avatar", "banner", "cover", "attachment"],
    },

    storageProvider: {
      type: String,
      enum: ["cloudinary", "firebase", "s3"],
      required: true,
      default: "cloudinary",
    },

    storagePath: {
      type: String, // Cloudinary public_id
      required: true,
    },

    expiresAt: Date,

    isExpired: {
      type: Boolean,
      default: false,
    },

    metadata: {
      size: Number,
      width: Number,
      height: Number,
      format: String,
      mimeType: String,
      originalName: String,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Media", mediaSchema);
