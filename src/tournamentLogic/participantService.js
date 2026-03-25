import mongoose from "mongoose";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import * as userStatsService from "../user/statschemaService.js";
import { updateGroupMetrics } from "../groupLogic/groupMetric.js";
import {
  NotFoundException,
  BadRequestError,
  ConflictException,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";
import moment from "moment";

// ================================
// REGISTER PARTICIPANT
// ================================
export const registerParticipant = async ({ tournamentId, userId }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tournament = await tournamentDb.findTournamentById(tournamentId);
    if (!tournament) throw new NotFoundException("Tournament not found");

    if (tournament.status !== "registration") {
      throw new BadRequestError("Tournament registration is closed");
    }

    if (moment().isAfter(tournament.registrationDeadline)) {
      throw new BadRequestError("Registration deadline has passed");
    }

    const membership = await membershipService.findMembership({
      userId,
      groupId: tournament.groupId._id || tournament.groupId,
    });
    if (!membership) throw new ForbiddenError("You must be a group member");

    const existing = await tournamentDb.findUserInTournament(
      tournamentId,
      userId,
    );
    if (existing) throw new ConflictException("Already registered");

    const capacityCheck =
      await tournamentDb.checkTournamentCapacity(tournamentId);
    if (capacityCheck.isFull) throw new BadRequestError("Tournament is full");

    const updatedTournament = await tournamentDb.addParticipant(
      tournamentId,
      userId,
      { session },
    );

    await userStatsService.createUserStats({
      user: userId,
      group: tournament.groupId._id || tournament.groupId,
      tournamentsPlayedin: tournamentId,
      session,
    });

    await updateGroupMetrics(
      tournament.groupId._id || tournament.groupId,
      session,
    );

    await session.commitTransaction();
    session.endSession();

    return {
      tournament: updatedTournament,
      message: "Successfully registered for tournament",
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};

// ================================
// WITHDRAW PARTICIPANT
// ================================
export const withdrawParticipant = async ({ tournamentId, userId, reason }) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const tournament = await tournamentDb.findTournamentById(tournamentId);
    if (!tournament) throw new NotFoundException("Tournament not found");

    const registration = await tournamentDb.findUserInTournament(
      tournamentId,
      userId,
    );
    if (!registration) {
      throw new NotFoundException("You are not registered for this tournament");
    }

    if (tournament.status === "ongoing") {
      throw new BadRequestError("Cannot withdraw from an ongoing tournament");
    }

    await tournamentDb.updateParticipantStatus(
      tournamentId,
      userId,
      "withdrawn",
      { session },
    );

    await tournamentDb.updateTournament(
      tournamentId,
      { $inc: { currentParticipants: -1 } },
      { session },
    );

    await userStatsService.deleteUserStats(
      userId,
      tournament.groupId._id || tournament.groupId,
      { session },
    );

    await updateGroupMetrics(
      tournament.groupId._id || tournament.groupId,
      session,
    );

    await session.commitTransaction();
    session.endSession();

    return {
      message: "Successfully withdrawn from tournament",
      reason,
    };
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }
};
