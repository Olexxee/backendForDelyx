import * as leagueTableService from "./leagueTableService.js";
import { asyncWrapper } from "../lib/utils.js";
import {
  NotFoundException,
  BadRequestError,
} from "../lib/classes/errorClasses.js";

// Get full league table
export const getLeagueTable = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;

  const table = await leagueTableService.generateLeagueTable(tournamentId);

  res.status(200).json({
    success: true,
    ...table,
  });
});

// Get mini table (top and bottom teams)
export const getMiniTable = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const { top = 5, bottom = 3 } = req.query;

  const miniTable = await leagueTableService.getMiniTable(tournamentId, {
    top: parseInt(top),
    bottom: parseInt(bottom),
  });

  res.status(200).json({
    success: true,
    ...miniTable,
  });
});

// Get head-to-head record
export const getHeadToHead = asyncWrapper(async (req, res) => {
  const { tournamentId, team1Id, team2Id } = req.params;

  const h2hRecord = await leagueTableService.getHeadToHeadRecord(
    tournamentId,
    team1Id,
    team2Id
  );

  res.status(200).json({
    success: true,
    headToHead: h2hRecord,
  });
});

// Get team's position and context
export const getTeamPosition = asyncWrapper(async (req, res) => {
  const { tournamentId, teamId } = req.params;

  const position = await leagueTableService.getTeamPosition(
    tournamentId,
    teamId
  );

  res.status(200).json({
    success: true,
    ...position,
  });
});

// Get historical table (up to specific matchday)
export const getHistoricalTable = asyncWrapper(async (req, res) => {
  const { tournamentId, matchday } = req.params;

  if (!matchday || matchday < 1) {
    throw new BadRequestError("Valid matchday number required");
  }

  const historicalTable = await leagueTableService.getHistoricalTable(
    tournamentId,
    parseInt(matchday)
  );

  res.status(200).json({
    success: true,
    ...historicalTable,
  });
});

// Get table with live updates (if matches are ongoing)
export const getLiveTable = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;

  // This would include live match data if you implement real-time scoring
  const table = await leagueTableService.generateLeagueTable(tournamentId);

  res.status(200).json({
    success: true,
    ...table,
    isLive: true,
    lastUpdated: new Date(),
  });
});
