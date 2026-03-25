import { Schema, model } from "mongoose";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import configService from "../lib/classes/configClass.js";

const UserSchema = new Schema(
  {
    username: {
      type: String,
      unique: true,
      trim: true,
    },

    name: {
      type: String,
      trim: true,
      default: "",
    },

    password: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    verified: {
      type: Boolean,
      default: false,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
    },

    profilePicture: {
      type: String,
      default: "Upload A picture",
    },

    verificationCode: {
      type: String,
      select: false,
    },

    verificationCodeValidation: {
      type: String,
      select: false,
    },

    verificationCodeExpiresAt: {
      type: Date,
      select: false,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    role: {
      type: String,
      enum: ["admin", "user", "superadmin"],
      default: "user",
    },

    deviceTokens: {
      type: [String],
      default: [],
    },

    groupsCreatedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    groupsJoinedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    groups: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
      },
    ],

    adminGroupsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    timesKicked: {
      type: Number,
      default: 0,
      min: 0,
    },

    timesBannedFromGroups: {
      type: Number,
      default: 0,
      min: 0,
    },

    groupsCreated: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Group",
      },
    ],
  },
  { timestamps: true },
);

UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;

  this.password = await bcrypt.hash(
    this.password,
    parseInt(configService.getOrThrow("SALT_ROUNDS"), 10),
  );
});

const User = model("User", UserSchema);
export default User;