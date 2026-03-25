import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    score: { type: Number, default: 0 },
    goals: { type: Number, default: 0 },
    kills: { type: Number, default: 0 },
    isWinner: { type: Boolean, default: false },
  },
  { _id: false },
);

const matchSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tournament",
      required: true,
    },
    participants: [participantSchema],
    homeTeam: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    awayTeam: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    homeGoals: { type: Number, default: 0 },
    awayGoals: { type: Number, default: 0 },
    matchday: { type: Number },
    isClosed: { type: Boolean, default: false },
    closedAt: Date,
  },
  { timestamps: true },
);

export default mongoose.model("Match", matchSchema);
