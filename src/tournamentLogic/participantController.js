import * as participantService from "./participantService.js";
import { ValidatorClass } from "../lib/classes/validatorClass.js";
import {
  registerParticipantSchema,
  bulkRegisterSchema,
  withdrawParticipantSchema,
} from "./participantRequestSchema.js";
import {
  ValidationException,
  NotFoundException,
} from "../lib/classes/errorClasses.js";
import { asyncWrapper } from "../lib/utils.js";

const validator = new ValidatorClass();

// Register for tournament
export const registerForTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  const result = await participantService.registerParticipant({
    tournamentId,
    userId,
  });

  res.status(201).json({
    success: true,
    ...result,
  });
});

// Bulk register participants (admin only)
export const bulkRegisterParticipants = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const adminId = req.user._id;

  const { errors, value } = validator.validate(bulkRegisterSchema, req.body);
  if (errors) throw new ValidationException(errors);

  const results = await participantService.bulkRegisterParticipants({
    tournamentId,
    userIds: value.userIds,
    adminId,
  });

  res.status(200).json({
    success: true,
    message: "Bulk registration completed",
    results,
  });
});

// Withdraw from tournament
export const withdrawFromTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  const { errors, value } = validator.validate(
    withdrawParticipantSchema,
    req.body
  );
  if (errors) throw new ValidationException(errors);

  const result = await participantService.withdrawParticipant({
    tournamentId,
    userId,
    reason: value.reason,
  });

  res.status(200).json({
    success: true,
    ...result,
  });
});

// Get tournament participants
export const getTournamentParticipants = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;

  const participants = await participantService.getTournamentParticipants(
    tournamentId
  );

  res.status(200).json({
    success: true,
    participants: participants.participants,
    meta: {
      currentParticipants: participants.currentParticipants,
      maxParticipants: participants.maxParticipants,
      availableSlots:
        participants.maxParticipants - participants.currentParticipants,
    },
  });
});

// Get user's tournaments
export const getUserTournaments = asyncWrapper(async (req, res) => {
  const userId = req.user._id;

  const tournaments = await participantService.getUserTournaments(userId);

  res.status(200).json({
    success: true,
    tournaments,
  });
});

// Get tournament standings/leaderboard
export const getTournamentStandings = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;

  // This uses your existing userStatsService
  const standings = await userStatsService.getGroupStatsByTournament(
    req.params.groupId, // You'll need to pass this or get it from tournament
    tournamentId
  );

  res.status(200).json({
    success: true,
    standings: standings.sort((a, b) => a.rank - b.rank),
  });
});
