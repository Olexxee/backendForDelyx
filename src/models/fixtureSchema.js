import mongoose from "mongoose";

const fixtureSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      required: true,
      index: true,
    },

    matchday: {
      type: Number,
      required: true,
      min: 1,
    },

    homeTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    awayTeam: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // normalized pair key: smallerId_largerId
    pairKey: {
      type: String,
      required: true,
      index: true,
    },

    leg: {
      type: Number,
      default: 1,
      min: 1,
    },

    matchId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Match",
      default: null,
    },

    scheduledDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["scheduled", "in_progress", "completed", "postponed"],
      default: "scheduled",
    },

    homeGoals: {
      type: Number,
      default: 0,
      min: 0,
    },

    awayGoals: {
      type: Number,
      default: 0,
      min: 0,
    },

    isCompleted: {
      type: Boolean,
      default: false,
    },

    completedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

fixtureSchema.index({ tournamentId: 1, matchday: 1 });
fixtureSchema.index({ tournamentId: 1, homeTeam: 1, awayTeam: 1, leg: 1 }, { unique: true });
fixtureSchema.index({ tournamentId: 1, pairKey: 1, leg: 1 });

fixtureSchema.pre("validate", function (next) {
  if (this.homeTeam && this.awayTeam) {
    const ids = [this.homeTeam.toString(), this.awayTeam.toString()].sort();
    this.pairKey = `${ids[0]}_${ids[1]}`;
  }

  if (this.homeTeam?.toString() === this.awayTeam?.toString()) {
    return next(new Error("homeTeam and awayTeam cannot be the same"));
  }

  if (this.isCompleted && !this.completedAt) {
    this.completedAt = new Date();
  }

  next();
});

export default mongoose.model("Fixture", fixtureSchema);