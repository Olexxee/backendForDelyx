import mongoose from "mongoose";
import { encrypt } from "../lib/encryption.js";
import ChatRoom from "./chatRoomSchema.js";

const messageSchema = new mongoose.Schema(
  {
    chatRoom: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ChatRoom",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    content: { type: String }, // optional plaintext for hook
    encryptedContent: { type: String }, // encrypted message
    iv: { type: String }, // encryption initialization vector
    authTag: { type: String }, // auth tag for encryption
    media: [{ type: String }], // array of media URLs
    deliveredTo: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true },
);

/* ---------------------- Pre-save Hook ---------------------- */
// Encrypt content if present before saving
messageSchema.pre("save", async function (next) {
  console.log("Pre-save hook triggered for message:", this._id);
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
      console.log("Message encrypted successfully for message:", this._id);
    }
    next();
  } catch (err) {
    next(err);
  }
});

/* ---------------------- Export ---------------------- */
export default mongoose.model("Message", messageSchema);
