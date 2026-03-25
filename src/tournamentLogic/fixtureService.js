import mongoose from "mongoose";
import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as membershipService from "../groupLogic/membershipService.js";
import * as userStatsService from "../user/statschemaService.js";
import * as leagueService from "./leagueTableService.js";
import { updateGroupMetrics } from "../groupLogic/groupMetric.js";
import cache from "../lib/cache.js";
import {
  NotFoundException,
  BadRequestError,
  ConflictException,
} from "../lib/classes/errorClasses.js";

// ================================
// COMPLETE FIXTURE & UPDATE STATS
// ================================
export const completeFixture = async ({
  fixtureId,
  homeGoals,
  awayGoals,
}) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const fixture = await fixtureDb.findFixtureById(fixtureId, { session });
    if (!fixture) {
      throw new NotFoundException("Fixture not found");
    }

    if (fixture.isCompleted) {
      throw new BadRequestError("Fixture already completed");
    }

    const tournament = await tournamentDb.findTournamentById(
      fixture.tournamentId,
      { session },
    );
    if (!tournament) {
      throw new NotFoundException("Tournament not found");
    }

    const updatedFixture = await fixtureDb.updateFixtureResult(
      fixtureId,
      { homeGoals, awayGoals },
      { session },
    );

    await leagueService.applyFixtureResult(
      {
        tournamentId: fixture.tournamentId,
        fixtureId: fixture._id,
        homeTeamId: fixture.homeTeam,
        awayTeamId: fixture.awayTeam,
        homeGoals,
        awayGoals,
      },
      { session },
    );

    await userStatsService.updateParticipantStatsForFixture(
      {
        tournamentId: fixture.tournamentId,
        groupId: tournament.groupId._id || tournament.groupId,
        homeUserId: fixture.homeTeam,
        awayUserId: fixture.awayTeam,
        homeGoals,
        awayGoals,
        playedAt: new Date(),
      },
      { session },
    );

    const allFixtures = await fixtureDb.getTournamentFixtures(
      fixture.tournamentId,
      { session },
    );

    const currentMatchdayFixtures = allFixtures.filter(
      (item) => Number(item.matchday) === Number(fixture.matchday),
    );

    const currentMatchdayDone = currentMatchdayFixtures.every(
      (item) => item.isCompleted,
    );

    if (currentMatchdayDone) {
      const remainingFixtures = allFixtures.filter((item) => !item.isCompleted);

      if (remainingFixtures.length === 0) {
        tournament.status = "completed";

        const participantIds = tournament.participants
          .filter((p) => p.status === "registered")
          .map((p) => p.userId._id || p.userId);

        const standings = await leagueService.getTournamentStandings(
          fixture.tournamentId,
          { session },
        );

        const winnerId = standings?.[0]?.participantId || null;

        await userStatsService.recordTournamentCompletion(
          {
            participantIds,
            winnerId,
            tournamentId: fixture.tournamentId,
            groupId: tournament.groupId._id || tournament.groupId,
          },
          { session },
        );
      } else if (
        Number(tournament.currentMatchday) === Number(fixture.matchday)
      ) {
        tournament.currentMatchday = Number(tournament.currentMatchday) + 1;
      }

      await tournament.save({ session });
    }

    await updateGroupMetrics(
      tournament.groupId._id || tournament.groupId,
      session,
    );

    await session.commitTransaction();

    await cache.deleteByPattern(`tournament:${fixture.tournamentId}:*`);
    await cache.deleteByPattern(`user:*:upcoming-fixtures`);

    return {
      message: "Fixture completed and stats updated successfully",
      fixture: updatedFixture,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ================================
// GENERATE TOURNAMENT FIXTURES
// ================================
export const generateTournamentFixtures = async ({ tournamentId, userId }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const tournament = await tournamentDb.findTournamentById(tournamentId);
    if (!tournament) {
      throw new NotFoundException("Tournament not found");
    }

    await membershipService.assertIsAdmin({
      userId,
      groupId: tournament.groupId._id || tournament.groupId,
    });

    const result = await generateTournamentFixturesCore({
      tournamentId,
      session,
    });

    await tournamentDb.updateTournament(
      tournamentId,
      { status: "upcoming" },
      { session },
    );

    await session.commitTransaction();

    await cache.deleteByPattern(`tournament:${tournamentId}:*`);

    return {
      message: "Fixtures generated successfully",
      ...result,
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ================================
// GENERATE FIXTURES CORE
// ================================
export const generateTournamentFixturesCore = async ({
  tournamentId,
  session,
}) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId, {
    session,
  });

  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  if (tournament.status !== "registration") {
    throw new BadRequestError(
      "Can only generate fixtures during registration phase",
    );
  }

  const existingFixtures = await fixtureDb.fixturesExist(tournamentId, {
    session,
  });

  if (existingFixtures) {
    throw new ConflictException("Fixtures already generated");
  }

  const activeParticipants = tournament.participants
    .filter((participant) => participant.status === "registered")
    .map((participant) => participant.userId._id || participant.userId);

  if (activeParticipants.length < 2) {
    throw new BadRequestError(
      "Tournament needs at least 2 participants to generate fixtures",
    );
  }

  const fixtures =
    tournament.settings.rounds === "double"
      ? generateDoubleRoundRobinFixtures(activeParticipants, tournamentId)
      : generateSingleRoundRobinFixtures(activeParticipants, tournamentId);

  const createdFixtures = await fixtureDb.createFixtures(fixtures, { session });
  const totalMatchdays = Math.max(...fixtures.map((fixture) => fixture.matchday));

  await userStatsService.ensureTournamentStatsForParticipants(
    {
      participantIds: activeParticipants,
      tournamentId: tournament._id,
    },
    { session },
  );

  await tournamentDb.updateTournament(
    tournamentId,
    {
      totalMatchdays,
      currentMatchday: 1,
    },
    { session },
  );

  await updateGroupMetrics(
    tournament.groupId._id || tournament.groupId,
    session,
  );

  return {
    fixtures: createdFixtures,
    fixturesCount: createdFixtures.length,
    totalMatchdays,
  };
};

// ================================
// REGENERATE FIXTURES (ADMIN ONLY)
// ================================
export const regenerateFixtures = async ({ tournamentId, userId }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const tournament = await tournamentDb.findTournamentById(tournamentId);
    if (!tournament) {
      throw new NotFoundException("Tournament not found");
    }

    await membershipService.assertIsAdmin({
      userId,
      groupId: tournament.groupId._id || tournament.groupId,
    });

    if (tournament.status === "ongoing") {
      throw new BadRequestError(
        "Cannot regenerate fixtures for an ongoing tournament",
      );
    }

    await fixtureDb.deleteAllFixtures(tournamentId, { session });

    await tournamentDb.updateTournament(
      tournamentId,
      {
        status: "registration",
        currentMatchday: 0,
        totalMatchdays: 0,
      },
      { session },
    );

    await session.commitTransaction();

    return generateTournamentFixtures({ tournamentId, userId });
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ================================
// FIXTURE QUERIES
// ================================
export const getTournamentFixtures = async (tournamentId) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  const fixtures = await fixtureDb.getTournamentFixtures(tournamentId);

  return {
    tournament: {
      id: tournament._id,
      name: tournament.name,
      status: tournament.status,
      currentMatchday: tournament.currentMatchday,
      totalMatchdays: tournament.totalMatchdays,
    },
    fixturesCount: fixtures.length,
    fixtures,
  };
};

export const getMatchdayFixtures = async ({ tournamentId, matchday }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  const [fixtures, stats] = await Promise.all([
    fixtureDb.getMatchdayFixtures(tournamentId, matchday),
    fixtureDb.getMatchdayStats(tournamentId, matchday),
  ]);

  return {
    tournament: { id: tournament._id, name: tournament.name },
    matchday,
    fixtures,
    stats,
  };
};

export const getTeamFixtures = async ({ tournamentId, teamId }) => {
  const fixtures = await fixtureDb.getTeamFixtures(tournamentId, teamId);

  return {
    teamId,
    fixtures: fixtures.map((fixture) => {
      const isHome =
        fixture.homeTeam._id.toString() === teamId.toString();

      return {
        ...fixture.toObject(),
        isHome,
        opponent: isHome ? fixture.awayTeam : fixture.homeTeam,
      };
    }),
  };
};

// ================================
// START TOURNAMENT (ADMIN ONLY)
// ================================
export const startTournament = async ({ tournamentId, userId }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const tournament = await tournamentDb.findTournamentById(tournamentId);
    if (!tournament) {
      throw new NotFoundException("Tournament not found");
    }

    await membershipService.assertIsAdmin({
      userId,
      groupId: tournament.groupId._id || tournament.groupId,
    });

    const fixturesExist = await fixtureDb.fixturesExist(tournamentId);
    if (!fixturesExist) {
      throw new BadRequestError(
        "Generate fixtures before starting the tournament",
      );
    }

    await tournamentDb.updateTournament(
      tournamentId,
      {
        status: "ongoing",
        startDate: new Date(),
        currentMatchday: 1,
      },
      { session },
    );

    await updateGroupMetrics(
      tournament.groupId._id || tournament.groupId,
      session,
    );

    await session.commitTransaction();

    await cache.deleteByPattern(`tournament:${tournamentId}:*`);

    return {
      message: "Tournament started successfully",
      status: "ongoing",
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};

// ================================
// HELPERS: ROUND-ROBIN GENERATION
// ================================
const generateSingleRoundRobinFixtures = (participants, tournamentId) => {
  const fixtures = [];
  const participantCount = participants.length;
  const normalizedParticipants =
    participantCount % 2 === 0 ? participants : [...participants, null];
  const totalRounds = normalizedParticipants.length - 1;

  let matchday = 1;

  for (let round = 0; round < totalRounds; round += 1) {
    for (
      let matchIndex = 0;
      matchIndex < normalizedParticipants.length / 2;
      matchIndex += 1
    ) {
      const homeIndex = (round + matchIndex) % totalRounds;
      const awayIndex = (totalRounds - matchIndex + round) % totalRounds;

      const homeTeam =
        homeIndex === totalRounds
          ? normalizedParticipants[totalRounds]
          : normalizedParticipants[homeIndex];

      const awayTeam =
        awayIndex === totalRounds
          ? normalizedParticipants[totalRounds]
          : normalizedParticipants[awayIndex];

      if (homeTeam && awayTeam && String(homeTeam) !== String(awayTeam)) {
        fixtures.push({
          tournamentId,
          matchday,
          homeTeam,
          awayTeam,
        });
      }
    }

    matchday += 1;
  }

  return fixtures;
};

const generateDoubleRoundRobinFixtures = (participants, tournamentId) => {
  const firstRound = generateSingleRoundRobinFixtures(
    participants,
    tournamentId,
  );

  const maxMatchday = Math.max(
    ...firstRound.map((fixture) => fixture.matchday),
  );

  const secondRound = firstRound.map((fixture) => ({
    ...fixture,
    matchday: fixture.matchday + maxMatchday,
    homeTeam: fixture.awayTeam,
    awayTeam: fixture.homeTeam,
  }));

  return [...firstRound, ...secondRound];
};