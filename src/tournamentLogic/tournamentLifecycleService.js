import mongoose from "mongoose";
import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import cache from "../lib/cache.js";
import {
  NotFoundException,
  BadRequestError,
} from "../lib/classes/errorClasses.js";
import {
  checkTournamentReadiness,
  generateTournamentFixturesCore,
} from "./tournamentDomainService.js";
import { updateGroupMetrics } from "../groupLogic/groupMetric.js";

export const autoStartTournamentFromDeadline = async ({ tournamentId }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const tournament = await tournamentDb.findTournamentById(tournamentId, {
      session,
    });

    if (!tournament) {
      throw new NotFoundException("Tournament not found");
    }

    if (tournament.status !== "registration") {
      await session.commitTransaction();
      console.log(
        `[TournamentScheduler] Skipping auto-start for ${tournamentId}: already ${tournament.status}`,
      );
      return {
        skipped: true,
        reason: `Tournament already in '${tournament.status}' status`,
      };
    }

   const readiness = await checkTournamentReadiness({
  tournamentId,
  session,
});

    if (!readiness.canStart) {
      throw new BadRequestError(
        readiness.reasons.join(", ") || "Tournament is not ready to start",
      );
    }

    const fixturesExist = await fixtureDb.fixturesExist(tournamentId, {
      session,
    });

    if (!fixturesExist) {
      await generateTournamentFixturesCore({ tournamentId, session });
    }

    tournament.status = "ongoing";
    tournament.startDate = new Date();
    tournament.currentMatchday = tournament.currentMatchday || 1;

    await tournament.save({ session });

    const groupId = tournament.groupId._id ?? tournament.groupId;
    await updateGroupMetrics(groupId, session);

    await session.commitTransaction();

    await cache.deleteByPattern(`tournament:${tournamentId}:*`);

    return {
      success: true,
      message: "Tournament auto-started successfully",
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

export const autoCompleteTournament = async ({ tournamentId }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const tournament = await tournamentDb.findTournamentById(tournamentId, {
      session,
    });

    if (!tournament) {
      throw new NotFoundException("Tournament not found");
    }

    if (tournament.status === "completed") {
      await session.commitTransaction();
      console.log(
        `[TournamentScheduler] Skipping auto-complete for ${tournamentId}: already completed`,
      );
      return {
        skipped: true,
        reason: "Tournament already completed",
      };
    }

    if (tournament.status !== "ongoing") {
      throw new BadRequestError(
        `Cannot auto-complete tournament in '${tournament.status}' status`,
      );
    }

    tournament.status = "completed";
    await tournament.save({ session });

    const groupId = tournament.groupId._id ?? tournament.groupId;
    await updateGroupMetrics(groupId, session);

    await session.commitTransaction();

    await cache.deleteByPattern(`tournament:${tournamentId}:*`);

    return {
      success: true,
      message: "Tournament auto-completed successfully",
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};