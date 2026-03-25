import * as tournamentService from "./tournamentService.js";
import * as fixtureService from "./fixtureService.js";
import { validateBody } from "../middlewares/validatorMiddleware.js";
import {
  createTournamentSchema,
  updateTournamentSchema,
} from "./tournamentRequestSchema.js";
import {
  ValidationException,
  NotFoundException,
} from "../lib/classes/errorClasses.js";
import { asyncWrapper } from "../lib/utils.js";

// ================================
// CREATE TOURNAMENT
// ================================
export const createTournament = asyncWrapper(async (req, res) => {
  const userId = req.user._id;
  const { groupId } = req.params;
  const tournament = await tournamentService.createTournament({
    ...req.body,
    createdBy: userId,
    groupId,
  });

  res.status(201).json({
    success: true,
    message: "Tournament created successfully",
    tournament,
  });
});

export const getTournament = asyncWrapper(async (req, res, next) => {
  const { tournamentId } = req.params;

  const userId = req.user?._id ?? req.user?.id ?? null;

  const tournament = await tournamentService.getTournamentById(
    tournamentId,
    userId,
  );

  res.json({
    success: true,
    tournament,
  });
});

export const joinTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;

  const userId = req.user?._id ?? req.user?.id;

  const result = await tournamentService.joinGroupAndTournament({
    tournamentId,
    userId,
  });

  res.json({
    success: true,
    ...result,
  });
});

// ================================
// GET ALL TOURNAMENTS FOR A GROUP
// ================================
export const getGroupTournaments = asyncWrapper(async (req, res) => {
  const { groupId } = req.params;
  const { status } = req.query;

  const tournaments = await tournamentService.getGroupTournaments(
    groupId,
    status,
  );

  res.status(200).json({
    success: true,
    tournaments,
  });
});

// ================================
// UPDATE TOURNAMENT
// ================================
export const updateTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  const { errors, value } = validateBody(updateTournamentSchema, req.body);
  if (errors) throw new ValidationException(errors);

  const updatedTournament = await tournamentService.updateTournament({
    tournamentId,
    userId,
    updateData: value,
  });

  res.status(200).json({
    success: true,
    message: "Tournament updated successfully",
    tournament: updatedTournament,
  });
});

// ================================
// CANCEL TOURNAMENT
// ================================
export const cancelTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  await tournamentService.cancelTournament({ tournamentId, userId });

  res.status(200).json({
    success: true,
    message: "Tournament cancelled successfully",
  });
});

// ================================
// CHECK TOURNAMENT READINESS
// ================================
export const checkTournamentReadiness = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;

  const readiness =
    await tournamentService.checkTournamentReadiness(tournamentId);

  res.status(200).json({
    success: true,
    readiness,
  });
});

export const getAllTournaments = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 10, status } = req.query;

  const result = await tournamentService.getAllTournaments({
    page: Number(page),
    limit: Number(limit),
    status,
  });

  res.status(200).json({
    success: true,
    tournaments: result.tournaments,
    pagination: result.pagination,
  });
});

// ================================
// START TOURNAMENT
// ================================
export const startTournament = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;
  const userId = req.user._id;

  const result = await fixtureService.startTournament({ tournamentId, userId });

  res.status(200).json({
    success: true,
    message: result.message,
    status: result.status,
    tournament: result.tournament || null, // optional: updated tournament object
    nextMatch: result.nextMatch || null, // optional: next match for UI
  });
});

// ================================
// GET TOURNAMENT TABLE (LEAGUE STATS)
// ================================
export const getTournamentTable = asyncWrapper(async (req, res) => {
  const { tournamentId } = req.params;

  const tournamentData =
    await tournamentService.getTournamentWithTable(tournamentId);

  res.status(200).json({
    success: true,
    tournament: tournamentData.tournament,
    table: tournamentData.currentTable,
    tableStats: tournamentData.tableStats,
  });
});
