import Match from "./matchSchema.js";
import Tournament from ".tournamentSchema.js";
import TournamentStanding from "./tournamentStandingSchema.js";

export const closeMatch = async (matchId) => {
  const match = await Match.findById(matchId);
  if (!match || match.isClosed) throw new Error("Invalid match");

  match.isClosed = true;
  match.closedAt = new Date();
  await match.save();

  for (const p of match.participants) {
    const standing = await TournamentStanding.findOneAndUpdate(
      { userId: p.userId, tournamentId: match.tournamentId },
      {
        $inc: {
          matchesPlayed: 1,
          wins: p.isWinner ? 1 : 0,
          losses: !p.isWinner ? 1 : 0,
          goalsScored: p.goals,
          goalsConceded: 0,
          points: p.isWinner ? 3 : 0,
        },
        lastUpdated: new Date(),
      },
      { upsert: true, new: true },
    );
  }

  const tournament = await Tournament.findById(match.tournamentId);
  tournament.completedMatches += 1;
  if (tournament.completedMatches >= tournament.totalMatches) {
    tournament.status = "completed";
  }
  await tournament.save();
};
