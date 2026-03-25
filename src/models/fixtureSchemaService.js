import mongoose from "mongoose";
import Fixture from "./fixtureSchema.js";

// ============================================================
// CREATE
// ============================================================

export const createFixtures = async (fixtures, options = {}) => {
  const { session } = options;
  return Fixture.insertMany(fixtures, { session });
};

// ============================================================
// FIND
// ============================================================

export const getTournamentFixtures = async (
  tournamentId,
  options = {},
) => {
  const { session } = options;

  return Fixture.find({ tournamentId })
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture")
    .populate("matchId")
    .sort({ matchday: 1, createdAt: 1 })
    .session(session || null);
};

export const getMatchdayFixtures = async (
  tournamentId,
  matchday,
  options = {},
) => {
  const { session } = options;

  return Fixture.find({ tournamentId, matchday })
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture")
    .populate("matchId")
    .sort({ createdAt: 1 })
    .session(session || null);
};

export const getTeamFixtures = async (
  tournamentId,
  teamId,
  options = {},
) => {
  const { session } = options;

  return Fixture.find({
    tournamentId,
    $or: [{ homeTeam: teamId }, { awayTeam: teamId }],
  })
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture")
    .populate("matchId")
    .sort({ matchday: 1 })
    .session(session || null);
};

export const getCompletedFixtures = async (
  tournamentId,
  options = {},
) => {
  const { session } = options;

  return Fixture.find({
    tournamentId,
    isCompleted: true,
  })
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture")
    .sort({ completedAt: -1 })
    .session(session || null);
};

export const getUpcomingFixtures = async (
  tournamentId,
  options = {},
) => {
  const { session, limit = 10 } = options;

  return Fixture.find({
    tournamentId,
    isCompleted: false,
    status: "scheduled",
  })
    .populate("homeTeam", "username profilePicture")
    .populate("awayTeam", "username profilePicture")
    .sort({ matchday: 1, createdAt: 1 })
    .limit(limit)
    .session(session || null);
};

export const fixturesExist = async (tournamentId, options = {}) => {
  const { session } = options;
  const count = await Fixture.countDocuments({ tournamentId }).session(session || null);
  return count > 0;
};

// ============================================================
// UPDATE
// ============================================================

export const updateFixtureResult = async (
  fixtureId,
  resultData,
  options = {},
) => {
  const { session } = options;

  return Fixture.findByIdAndUpdate(
    fixtureId,
    {
      ...resultData,
      isCompleted: true,
      completedAt: new Date(),
      status: "completed",
    },
    {
      new: true,
      session,
    },
  );
};

// ============================================================
// DELETE
// ============================================================

export const deleteAllFixtures = async (tournamentId, options = {}) => {
  const { session } = options;
  return Fixture.deleteMany({ tournamentId }).session(session || null);
};

// ============================================================
// ANALYTICS
// ============================================================

export const getMatchdayStats = async (
  tournamentId,
  matchday,
  options = {},
) => {
  const { session } = options;

  const castTournamentId =
    typeof tournamentId === "string"
      ? new mongoose.Types.ObjectId(tournamentId)
      : tournamentId;

  const stats = await Fixture.aggregate([
    {
      $match: {
        tournamentId: castTournamentId,
        matchday,
      },
    },
    {
      $group: {
        _id: null,
        totalFixtures: { $sum: 1 },
        completedFixtures: {
          $sum: { $cond: ["$isCompleted", 1, 0] },
        },
        totalGoals: {
          $sum: {
            $add: [
              { $ifNull: ["$homeGoals", 0] },
              { $ifNull: ["$awayGoals", 0] },
            ],
          },
        },
      },
    },
  ]).session(session || null);

  return (
    stats[0] || {
      totalFixtures: 0,
      completedFixtures: 0,
      totalGoals: 0,
    }
  );
};