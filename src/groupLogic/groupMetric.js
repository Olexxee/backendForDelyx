import Group from "../groupLogic/groupSchema.js";
import Tournament from "../models/tournamentSchema.js";
import TournamentStanding from "../models/tournamentStandingSchema.js";
import mongoose from "mongoose";

export const updateGroupMetrics = async (groupId) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) return;

  const group = await Group.findById(groupId);
  if (!group) return;

  const activeTournaments = await Tournament.find({
    groupId,
    status: { $in: ["registration", "ongoing"] },
  });

  const activeTournamentsCount = activeTournaments.length;
  const totalParticipantsCount = activeTournaments.reduce(
    (acc, t) => acc + (t.participants?.length || 0),
    0,
  );

  const standings = await TournamentStanding.find({ groupId });
  const avgPoints =
    standings.length > 0
      ? standings.reduce((acc, s) => acc + s.points, 0) / standings.length
      : 0;

  const participationRate =
    group.totalMembers > 0 ? standings.length / group.totalMembers : 0;

  const communityScore =
    activeTournamentsCount * 0.5 + participationRate * 0.3 + avgPoints * 0.2;

  const topGamers = standings
    .sort((a, b) => b.points - a.points)
    .slice(0, 5)
    .map((s) => ({ userId: s.userId, points: s.points }));
    
  group.activeTournamentsCount = activeTournamentsCount;
  group.totalParticipantsCount = totalParticipantsCount;
  group.avgPoints = avgPoints;
  group.communityScore = communityScore;
  group.topGamers = topGamers;

  await group.save();
};
