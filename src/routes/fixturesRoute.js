import requireGroupAdmin from "../admin/adminMiddleware.js";
import {
  generateFixtures,
  getTournamentFixtures,
  getMatchdayFixtures,
  getTeamFixtures,
  regenerateFixtures,
  startTournament,
  getUpcomingFixtures,
} from "../tournamentLogic/fixtureController.js";

// Generate fixtures (admin only)
router.post(
  "/:tournamentId/generate-fixtures",
  authMiddleware,
  requireGroupAdmin,
  generateFixtures
);

// Get all tournament fixtures
router.get("/:tournamentId/fixtures", authMiddleware, getTournamentFixtures);

// Get fixtures for specific matchday
router.get(
  "/:tournamentId/fixtures/matchday/:matchday",
  authMiddleware,
  getMatchdayFixtures
);

// Get team's fixtures in tournament
router.get(
  "/:tournamentId/fixtures/team/:teamId",
  authMiddleware,
  getTeamFixtures
);

// Regenerate fixtures (admin only)
router.post(
  "/:tournamentId/regenerate-fixtures",
  authMiddleware,
  requireGroupAdmin,
  regenerateFixtures
);

// Start tournament (admin only)
router.post(
  "/:tournamentId/start",
  authMiddleware,
  requireGroupAdmin,
  startTournament
);

// Get user's upcoming fixtures
router.get("/fixtures/upcoming", authMiddleware, getUpcomingFixtures);
