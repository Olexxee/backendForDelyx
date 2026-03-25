import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import { updateGroupMetrics } from "../groupLogic/groupMetric.js";
import cache from "../lib/cache.js";
import { NotFoundException } from "../lib/classes/errorClasses.js";

// ================================
// HELPER: BUILD TABLE FROM FIXTURES
// ================================
const buildTable = (participants, fixtures, tournamentSettings) => {
  const tableData = {};

  participants.forEach((id) => {
    tableData[id.toString()] = {
      userId: id,
      matchesPlayed: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [], // last 5 results
      position: 0,
    };
  });

  fixtures.forEach((f) => {
    const homeId = f.homeTeam._id.toString();
    const awayId = f.awayTeam._id.toString();
    const homeGoals = f.homeGoals ?? 0;
    const awayGoals = f.awayGoals ?? 0;

    tableData[homeId].matchesPlayed++;
    tableData[awayId].matchesPlayed++;

    tableData[homeId].goalsFor += homeGoals;
    tableData[homeId].goalsAgainst += awayGoals;
    tableData[awayId].goalsFor += awayGoals;
    tableData[awayId].goalsAgainst += homeGoals;

    tableData[homeId].goalDifference =
      tableData[homeId].goalsFor - tableData[homeId].goalsAgainst;
    tableData[awayId].goalDifference =
      tableData[awayId].goalsFor - tableData[awayId].goalsAgainst;

    let homeResult, awayResult;
    if (homeGoals > awayGoals) {
      tableData[homeId].wins++;
      tableData[awayId].losses++;
      tableData[homeId].points += tournamentSettings.pointsForWin;
      tableData[awayId].points += tournamentSettings.pointsForLoss;
      homeResult = "W";
      awayResult = "L";
    } else if (homeGoals < awayGoals) {
      tableData[awayId].wins++;
      tableData[homeId].losses++;
      tableData[awayId].points += tournamentSettings.pointsForWin;
      tableData[homeId].points += tournamentSettings.pointsForLoss;
      homeResult = "L";
      awayResult = "W";
    } else {
      tableData[homeId].draws++;
      tableData[awayId].draws++;
      tableData[homeId].points += tournamentSettings.pointsForDraw;
      tableData[awayId].points += tournamentSettings.pointsForDraw;
      homeResult = "D";
      awayResult = "D";
    }

    tableData[homeId].form.push(homeResult);
    tableData[awayId].form.push(awayResult);
    tableData[homeId].form = tableData[homeId].form.slice(-5);
    tableData[awayId].form = tableData[awayId].form.slice(-5);
  });

  const tableArray = Object.values(tableData).sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.goalDifference !== a.goalDifference)
      return b.goalDifference - a.goalDifference;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return 0; // head-to-head can be added later
  });

  tableArray.forEach((team, idx) => (team.position = idx + 1));

  return tableArray;
};

// ================================
// GENERATE CURRENT LEAGUE TABLE
// ================================
export const generateLeagueTable = async (tournamentId) => {
  const cacheKey = `tournament:${tournamentId}:table`;

  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const participants = tournament.participants
    .filter((p) => p.status === "registered")
    .map((p) => p.userId._id || p.userId);

  const completedFixtures = (
    await fixtureDb.getTournamentFixtures(tournamentId)
  ).filter((f) => f.isCompleted);

  const User = (await import("../user/userSchema.js")).default;
  const users = await User.find({ _id: { $in: participants } }).select(
    "username email profilePicture",
  );
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

  const table = buildTable(
    participants,
    completedFixtures,
    tournament.settings,
  );

  const populatedTable = table.map((team) => ({
    ...team,
    user: userMap[team.userId.toString()] || null,
  }));

  const result = {
    tournament: {
      id: tournament._id,
      name: tournament.name,
      status: tournament.status,
      currentMatchday: tournament.currentMatchday,
      totalMatchdays: tournament.totalMatchdays,
    },
    table: populatedTable,
    lastUpdated: new Date(),
  };

  // Update group metrics before caching
  await updateGroupMetrics(tournament.groupId._id || tournament.groupId);

  await cache.set(cacheKey, result, 120); // 2 minutes TTL
  return result;
};

// ================================
// GENERATE HISTORICAL TABLE
// ================================
export const getHistoricalTable = async (tournamentId, upToMatchday) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const participants = tournament.participants
    .filter((p) => p.status === "registered")
    .map((p) => p.userId._id || p.userId);

  const completedFixtures = (
    await fixtureDb.getTournamentFixtures(tournamentId)
  ).filter((f) => f.isCompleted && f.matchday <= upToMatchday);

  const User = (await import("../user/userSchema.js")).default;
  const users = await User.find({ _id: { $in: participants } }).select(
    "username email profilePicture",
  );
  const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

  const table = buildTable(
    participants,
    completedFixtures,
    tournament.settings,
  );

  const populatedTable = table.map((team) => ({
    ...team,
    user: userMap[team.userId.toString()] || null,
  }));

  return {
    tournament: {
      id: tournament._id,
      name: tournament.name,
    },
    table: populatedTable,
    asOfMatchday: upToMatchday,
    lastUpdated: new Date(),
  };
};
