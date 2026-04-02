import { Schema, model, Types } from "mongoose";

const GroupSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    bio: {
      type: String,
      default: "",
      trim: true,
    },

    banner: {
      type: Types.ObjectId,
      ref: "Media",
      default: null,
    },

    privacy: {
      type: String,
      enum: ["public", "private", "protected"],
      default: "public",
    },

    joinCode: {
      type: String,
      sparse: true,
      unique: true,
    },

    createdBy: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    totalMembers: {
      type: Number,
      default: 0,
      min: 0,
    },

    tournamentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    activeTournamentsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    chatRoom: {
      type: Types.ObjectId,
      ref: "ChatRoom",
      default: null,
    },

    lastTournamentAt: {
      type: Date,
      default: null,
    },

    aesKey: {
      type: String,
      required: true,
      select: false,
    },

    averagePoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    competitiveIndex: {
      type: Number,
      default: 0,
      min: 0,
    },

    settings: {
      type: Schema.Types.Mixed,
      default: () => ({
        allowMemberInvites: false,
        allowMemberTournamentCreation: false,
        requireJoinApproval: false,
      }),
    },

    lastActivityAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

// Indexes
GroupSchema.index({ lastActivityAt: -1 });
GroupSchema.index({ name: 1 }, { unique: true });
GroupSchema.index({ joinCode: 1 }, { unique: true, sparse: true });
GroupSchema.index({ createdBy: 1 });
GroupSchema.index({ isActive: 1, privacy: 1 });
GroupSchema.index({ competitiveIndex: -1 });
GroupSchema.index({ activeTournamentsCount: -1 });

export default model("Group", GroupSchema);
