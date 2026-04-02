import mongoose from "mongoose";
import { encrypt } from "../lib/encryption.js";
import ChatRoom from "./chatRoomSchema.js";

const messageSchema = new mongoose.Schema(
  {
    chatRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    messageType: {
      type: String,
      enum: ["text", "media", "mixed", "system"],
      default: "text",
      index: true,
    },

    content: {
      type: String,
    },

    encryptedContent: {
      type: String,
    },

    iv: {
      type: String,
    },

    authTag: {
      type: String,
    },

    media: [
      {
        type: String,
      },
    ],

    previewText: {
      type: String,
      default: "",
    },

    meta: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },

    deliveredTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    readBy: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    deliveredAt: {
      type: Date,
      default: null,
    },

    readAt: {
      type: Date,
      default: null,
    },

    deletedFor: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

messageSchema.index({ chatRoom: 1, createdAt: -1 });
messageSchema.index({ chatRoom: 1, isDeleted: 1, createdAt: -1 });

messageSchema.pre("save", async function (next) {
  try {
    if (this.isNew && this.content) {
      const room = await ChatRoom.findById(this.chatRoom).select("+aesKey");

      if (!room || !room.aesKey) {
        return next(new Error("AES key not available for chat room"));
      }

      const encrypted = encrypt(this.content, room.aesKey);

      this.encryptedContent = encrypted.cipherText;
      this.iv = encrypted.iv;
      this.authTag = encrypted.authTag;
      this.content = undefined;
    }

    next();
  } catch (err) {
    next(err);
  }
});

export default mongoose.model("Message", messageSchema);