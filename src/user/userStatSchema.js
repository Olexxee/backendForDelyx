import { Schema, Types, model } from "mongoose";

const UserStatSchema = new Schema(
  {
    userId: {
      type: Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    scopeType: {
      type: String,
      enum: ["global", "group", "tournament"],
      required: true,
      index: true,
    },

    scopeId: {
      type: Types.ObjectId,
      default: null,
      index: true,
      validate: {
        validator: function (value) {
          if (this.scopeType === "global") return value == null;
          return value != null;
        },
        message: "scopeId is required for group and tournament stats",
      },
    },

    tournamentsPlayed: {
      type: Number,
      default: 0,
      min: 0,
    },
    tournamentsWon: {
      type: Number,
      default: 0,
      min: 0,
    },
    tournamentsLost: {
      type: Number,
      default: 0,
      min: 0,
    },
    tournamentsDrawn: {
      type: Number,
      default: 0,
      min: 0,
    },

    matchesPlayed: {
      type: Number,
      default: 0,
      min: 0,
    },
    matchesWon: {
      type: Number,
      default: 0,
      min: 0,
    },
    matchesLost: {
      type: Number,
      default: 0,
      min: 0,
    },
    matchesDrawn: {
      type: Number,
      default: 0,
      min: 0,
    },

    goalsFor: {
      type: Number,
      default: 0,
      min: 0,
    },
    goalsAgainst: {
      type: Number,
      default: 0,
      min: 0,
    },
    goalDifference: {
      type: Number,
      default: 0,
    },

    cleanSheets: {
      type: Number,
      default: 0,
      min: 0,
    },

    points: {
      type: Number,
      default: 0,
      min: 0,
    },

    winRate: {
      type: Number,
      default: 0,
      min: 0,
    },

    currentWinStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    longestWinStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    currentUnbeatenStreak: {
      type: Number,
      default: 0,
      min: 0,
    },
    longestUnbeatenStreak: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastMatchAt: {
      type: Date,
      default: null,
    },

    lastTournamentAt: {
      type: Date,
      default: null,
    },

    rankScore: {
      type: Number,
      default: 0,
      min: 0,
      index: true,
    },

    form: {
      type: [
        {
          type: String,
          enum: ["W", "D", "L"],
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

UserStatSchema.index(
  { userId: 1, scopeType: 1, scopeId: 1 },
  { unique: true },
);

UserStatSchema.index({
  scopeType: 1,
  scopeId: 1,
  points: -1,
  goalDifference: -1,
  goalsFor: -1,
});

UserStatSchema.index({
  scopeType: 1,
  rankScore: -1,
  matchesWon: -1,
});

UserStatSchema.pre("save", function (next) {
  this.goalDifference = this.goalsFor - this.goalsAgainst;

  this.winRate =
    this.matchesPlayed > 0
      ? Number(((this.matchesWon / this.matchesPlayed) * 100).toFixed(2))
      : 0;

  if (this.currentWinStreak > this.longestWinStreak) {
    this.longestWinStreak = this.currentWinStreak;
  }

  if (this.currentUnbeatenStreak > this.longestUnbeatenStreak) {
    this.longestUnbeatenStreak = this.currentUnbeatenStreak;
  }

  if (this.form.length > 5) {
    this.form = this.form.slice(-5);
  }

  next();
});

export default model("UserStat", UserStatSchema);