import mongoose, { Schema, model } from "mongoose";
import { nanoid } from "nanoid";
import User from "../user/userSchema.js";

const PostSchema = new Schema(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: User,
      required: true,
    },
    mediaType: {
      type: String,
      enum: ["image", "video", "audio"],
      required: true,
    },
    mediaUrl: {
      type: String,
      required: true,
    },
    caption: {
      type: String,
      maxlength: 500,
    },
    comments: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (doc, ret) => {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
      },
    },
  }
);

PostSchema.pre("save", function (next) {
  if (!this.customId) {
    this.customId = `${this.user}-${nanoid(6)}`;
  }
  next();
});

export default model("Post", PostSchema);
