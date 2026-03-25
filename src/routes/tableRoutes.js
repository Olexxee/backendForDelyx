import {
  getLeagueTable,
  getMiniTable,
  getHeadToHead,
  getTeamPosition,
  getHistoricalTable,
  getLiveTable,
} from "../tournamentLogic/leagueTableController.js";

// Get full league table
router.get("/:tournamentId/table", authMiddleware, getLeagueTable);

// Get mini table (top/bottom teams)
router.get("/:tournamentId/table/mini", authMiddleware, getMiniTable);

// Get live table with real-time updates
router.get("/:tournamentId/table/live", authMiddleware, getLiveTable);

// Get historical table for specific matchday
router.get(
  "/:tournamentId/table/matchday/:matchday",
  authMiddleware,
  getHistoricalTable
);

// Get head-to-head record between two teams
router.get(
  "/:tournamentId/h2h/:team1Id/:team2Id",
  authMiddleware,
  getHeadToHead
);

// Get team's position and nearby teams
router.get(
  "/:tournamentId/table/team/:teamId",
  authMiddleware,
  getTeamPosition
);
