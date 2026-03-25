import { Schema, model, Types } from "mongoose";

const MembershipSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    groupId: {
      type: Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },

    roleInGroup: {
      type: String,
      enum: ["admin", "moderator", "member"],
      default: "member",
    },

    status: {
      type: String,
      enum: ["active", "pending", "banned"],
      default: "active",
    },

    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true },
);

MembershipSchema.index({ userId: 1, groupId: 1 }, { unique: true });
MembershipSchema.index({ groupId: 1, status: 1, joinedAt: 1 });
MembershipSchema.index({ userId: 1, status: 1, joinedAt: -1 });

export default model("Membership", MembershipSchema);