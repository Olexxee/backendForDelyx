import mongoose from "mongoose";
import { nanoid } from "nanoid";

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ["registered", "confirmed", "withdrawn"],
      default: "registered",
    },
  },
  { _id: false },
);

const tournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },

    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
      index: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    type: {
      type: String,
      enum: ["league", "cup", "hybrid"],
      default: "league",
    },

    description: {
      type: String,
      default: "",
      trim: true,
    },

    tournamentCode: {
      type: String,
      unique: true,
      index: true,
    },

    maxParticipants: {
      type: Number,
      default: 20,
      min: 4,
    },

    participants: {
      type: [participantSchema],
      default: [],
    },

    currentParticipants: {
      type: Number,
      default: 0,
      min: 0,
    },

    settings: {
      pointsForWin: {
        type: Number,
        default: 3,
        min: 0,
      },
      pointsForDraw: {
        type: Number,
        default: 1,
        min: 0,
      },
      pointsForLoss: {
        type: Number,
        default: 0,
        min: 0,
      },
      rounds: {
        type: String,
        enum: ["single", "double"],
        default: "single",
      },
    },

    registrationDeadline: {
      type: Date,
      required: true,
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    totalMatches: {
      type: Number,
      default: 0,
      min: 0,
    },

    completedMatches: {
      type: Number,
      default: 0,
      min: 0,
    },

    currentMatchday: {
      type: Number,
      default: 0,
      min: 0,
    },

    totalMatchdays: {
      type: Number,
      default: 0,
      min: 0,
    },

    status: {
      type: String,
      enum: ["upcoming", "registration", "ongoing", "completed", "cancelled"],
      default: "registration",
      index: true,
    },

    avgPoints: {
      type: Number,
      default: 0,
      min: 0,
    },

    communityScore: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true },
);

tournamentSchema.index({ groupId: 1, status: 1 });
tournamentSchema.index({ groupId: 1, createdAt: -1 });

tournamentSchema.pre("validate", function (next) {
  if (!this.tournamentCode) {
    this.tournamentCode = `T-${nanoid(8)}`;
  }

  if (this.currentParticipants !== this.participants.length) {
    this.currentParticipants = this.participants.length;
  }

  next();
});

export default mongoose.model("Tournament", tournamentSchema);