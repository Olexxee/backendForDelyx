import { Router } from "express";
import {
  createTournament,
  getTournament,
  getGroupTournaments,
  updateTournament,
  getAllTournaments,
  cancelTournament,
  checkTournamentReadiness,
  startTournament,
  getTournamentTable,
  joinTournament,
} from "../tournamentLogic/tournamentController.js";
import {
  createTournamentSchema,
  updateTournamentSchema,
} from "../tournamentLogic/tournamentRequestSchema.js";
import { validateBody } from "../middlewares/validatorMiddleware.js";
import {
  authMiddleware,
  optionalAuth,
} from "../middlewares/authenticationMdw.js";
import { requireGroupAdmin } from "../admin/adminMiddleware.js";

const tournamentRouter = Router();

// --------------------
// TOURNAMENT CRUD
// --------------------

// Get tournament details — optionalAuth so userId is available when logged in
// but the route stays public for guests
tournamentRouter.get("/:tournamentId", optionalAuth, getTournament);

// Create tournament (group admin only)
tournamentRouter.post(
  "/group/:groupId/create",
  authMiddleware,
  requireGroupAdmin,
  validateBody(createTournamentSchema),
  createTournament,
);

// Get all tournaments
tournamentRouter.get("/", getAllTournaments);

// Get all tournaments for a group
tournamentRouter.get("/group/:groupId", getGroupTournaments);

// Update tournament (group admin only)
tournamentRouter.patch(
  "/:tournamentId",
  authMiddleware,
  requireGroupAdmin,
  updateTournament,
);

// Cancel tournament (group admin only)
tournamentRouter.delete(
  "/:tournamentId",
  authMiddleware,
  requireGroupAdmin,
  cancelTournament,
);

// --------------------
// TOURNAMENT OPERATIONS
// --------------------

// Join group + tournament in one action (authenticated)
tournamentRouter.post("/:tournamentId/join", authMiddleware, joinTournament);

// Check readiness
tournamentRouter.get(
  "/:tournamentId/readiness",
  authMiddleware,
  checkTournamentReadiness,
);

// Start tournament (group admin only)
tournamentRouter.post(
  "/:tournamentId/start",
  authMiddleware,
  requireGroupAdmin,
  startTournament,
);

// Get league table / tournament stats
tournamentRouter.get(
  "/:tournamentId/table",
  authMiddleware,
  getTournamentTable,
);

export default tournamentRouter;
