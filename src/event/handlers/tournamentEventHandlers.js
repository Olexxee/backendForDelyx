import cache from "../../lib/cache.js";
import { updateGroupMetrics } from "../../groupLogic/groupMetric.js";
import * as userStatsService from "../../user/statschemaService.js";
import * as leagueService from "../../tournamentLogic/leagueTableService.js";
import { EVENT_TYPES } from "../eventTypes.js";

export const handleFixtureCompleted = async (payload) => {
  const {
    tournamentId,
    fixtureId,
    groupId,
    homeTeamId,
    awayTeamId,
    homeGoals,
    awayGoals,
    playedAt,
  } = payload;

  await leagueService.applyFixtureResult({
    tournamentId,
    fixtureId,
    homeTeamId,
    awayTeamId,
    homeGoals,
    awayGoals,
  });

  await userStatsService.updateParticipantStatsForFixture({
    tournamentId,
    groupId,
    homeUserId: homeTeamId,
    awayUserId: awayTeamId,
    homeGoals,
    awayGoals,
    playedAt,
  });

  await updateGroupMetrics({ groupId });

  await cache.deleteByPattern(`tournament:${tournamentId}:*`);
  await cache.deleteByPattern(`user:*:upcoming-fixtures`);
};

export const handleTournamentStarted = async (payload) => {
  const { tournamentId, groupId } = payload;

  await updateGroupMetrics({ groupId });
  await cache.deleteByPattern(`tournament:${tournamentId}:*`);
};

export const handleTournamentCompleted = async (payload) => {
  const { tournamentId, groupId, participantIds, winnerId } = payload;

  await userStatsService.recordTournamentCompletion({
    participantIds,
    winnerId,
    tournamentId,
    groupId,
  });

  await updateGroupMetrics({ groupId });
  await cache.deleteByPattern(`tournament:${tournamentId}:*`);
};

export const handleTournamentFixturesGenerated = async (payload) => {
  const { tournamentId, groupId } = payload;

  await updateGroupMetrics({ groupId });
  await cache.deleteByPattern(`tournament:${tournamentId}:*`);
};
