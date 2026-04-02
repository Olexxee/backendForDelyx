import mongoose from "mongoose";
import { generateRoomKey } from "../logic/chats/chatRoomKeyService.js";

const chatRoomSchema = new mongoose.Schema(
  {
    contextType: {
      type: String,
      enum: ["group", "direct"],
      required: true,
      index: true,
    },

    contextId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true,
      },
    ],

    aesKey: {
      type: String,
      required: true,
      select: true,
    },

    encryptionVersion: {
      type: Number,
      default: 1,
    },

    lastMessageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },

    lastMessagePreview: {
      type: String,
      default: "",
    },

    lastMessageAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true },
);

chatRoomSchema.index({ contextType: 1, contextId: 1 }, { unique: true });
chatRoomSchema.index({ participants: 1, lastMessageAt: -1 });

chatRoomSchema.pre("save", function (next) {
  if (!this.aesKey) {
    this.aesKey = generateRoomKey().toString("hex");
  }

  next();
});

export default mongoose.model("ChatRoom", chatRoomSchema);