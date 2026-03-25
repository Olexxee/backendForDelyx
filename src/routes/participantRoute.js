import { Router } from "express";
import {authMiddleware} from "../middlewares/authenticationMdw.js";
import { requireGroupAdmin } from "../admin/adminMiddleware.js";
import {
  registerForTournament,
  bulkRegisterParticipants,
  withdrawFromTournament,
  getTournamentParticipants,
  getUserTournaments,
  getTournamentStandings,
} from "../tournamentLogic/participantController.js";

const participantRouter = Router();

// Register for tournament
participantRouter.post("/:tournamentId/register", authMiddleware, registerForTournament);

// Bulk register participants (admin only)
participantRouter.post(
  "/:tournamentId/bulk-register",
  authMiddleware,
  requireGroupAdmin,
  bulkRegisterParticipants
);

// Withdraw from tournament
participantRouter.post("/:tournamentId/withdraw", authMiddleware, withdrawFromTournament);

// Get tournament participants
participantRouter.get(
  "/:tournamentId/participants",
  authMiddleware,
  getTournamentParticipants
);

// Get user's tournaments
participantRouter.get("/user/my-tournaments", authMiddleware, getUserTournaments);

// Get tournament standings
participantRouter.get("/:tournamentId/standings", authMiddleware, getTournamentStandings);

export default participantRouter;