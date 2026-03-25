import mongoose from "mongoose";

const tournamentStandingSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      required: true,
    },

    matchesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },
    draws: { type: Number, default: 0 },
    goalsScored: { type: Number, default: 0 },
    goalsConceded: { type: Number, default: 0 },
    points: { type: Number, default: 0 },
    rank: { type: Number, default: 0 },

    lastUpdated: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Indexes for fast leaderboard queries
tournamentStandingSchema.index({ tournamentId: 1, points: -1 });
tournamentStandingSchema.index(
  { userId: 1, tournamentId: 1 },
  { unique: true },
);

export default mongoose.model("TournamentStanding", tournamentStandingSchema);
