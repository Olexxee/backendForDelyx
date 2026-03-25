import Group from "../groupLogic/groupSchema.js";
import Tournament from "../models/tournamentSchema.js";
import TournamentStanding from "../models/tournamentStandingSchema.js";
import mongoose from "mongoose";

export const updateGroupMetrics = async ({ groupId, session = null }) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) return null;

  const group = await Group.findById(groupId).session(session || null);
  if (!group) return null;

  const activeTournaments = await Tournament.find({
    groupId,
    status: { $in: ["registration", "ongoing"] },
  }).session(session || null);

  const activeTournamentsCount = activeTournaments.length;

  const totalParticipantsCount = activeTournaments.reduce(
    (acc, tournament) =>
      acc +
      (tournament.participants?.filter((p) => p.status === "registered").length ||
        0),
    0,
  );

  const standings = await TournamentStanding.find({ groupId }).session(
    session || null,
  );

  const avgPoints =
    standings.length > 0
      ? standings.reduce((acc, standing) => acc + standing.points, 0) /
        standings.length
      : 0;

  const participationRate =
    group.totalMembers > 0 ? standings.length / group.totalMembers : 0;

  const communityScore =
    activeTournamentsCount * 0.5 + participationRate * 0.3 + avgPoints * 0.2;

  const topGamers = standings
    .sort((a, b) => b.points - a.points)
    .slice(0, 5)
    .map((standing) => ({
      userId: standing.userId,
      points: standing.points,
    }));

  group.activeTournamentsCount = activeTournamentsCount;
  group.totalParticipantsCount = totalParticipantsCount;
  group.avgPoints = avgPoints;
  group.communityScore = communityScore;
  group.topGamers = topGamers;

  await group.save({ session });

  return group;
};