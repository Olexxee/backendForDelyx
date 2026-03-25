import mongoose from "mongoose";
import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as userService from "../user/userService.js";
import * as userStatsService from "../user/statschemaService.js";
import * as membershipSchemaService from "../groupLogic/membershipSchemaService.js";
import * as groupDb from "../groupLogic/gSchemaService.js";
import Group from "../groupLogic/groupSchema.js";
import {
  scheduleTournamentJobs,
  rescheduleTournamentJobs,
} from "./tournamentScheduler.js";
import { updateGroupMetrics } from "../groupLogic/groupMetric.js";
import cache from "../lib/cache.js";

import {
  NotFoundException,
  BadRequestError,
  ConflictException,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";


// ============================================================
// PRIVATE HELPERS
// ============================================================

const buildUserSummary = (user, extra = {}) => ({
  id: user._id,
  username: user.username,
  profilePicture: user.profilePicture ?? null,
  ...extra,
});

const getObjectIdString = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (value._id) return value._id.toString();
  return value.toString();
};

const ensureTournamentExists = async ({ tournamentId, session = null }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId, {
    session,
  });

  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  return tournament;
};

const enrichFixtureWithTeams = async (
  fixture,
  { includeRole = false } = {},
) => {
  const [homeTeam, awayTeam] = await Promise.all([
    userService.getUserById(fixture.homeTeam._id ?? fixture.homeTeam),
    userService.getUserById(fixture.awayTeam._id ?? fixture.awayTeam),
  ]);

  return {
    id: fixture._id,
    matchday: fixture.matchday,
    scheduledDate: fixture.scheduledDate,
    status: fixture.status,
    isCompleted: fixture.isCompleted,
    homeTeam: buildUserSummary(
      homeTeam,
      includeRole ? { role: homeTeam.role } : {},
    ),
    awayTeam: buildUserSummary(
      awayTeam,
      includeRole ? { role: awayTeam.role } : {},
    ),
    homeGoals: fixture.homeGoals,
    awayGoals: fixture.awayGoals,
  };
};

const enrichFixturesWithTeams = async (fixtures, options = {}) => {
  return Promise.all(
    fixtures.map((fixture) => enrichFixtureWithTeams(fixture, options)),
  );
};

const enrichTeamScopedFixture = async ({ fixture, teamId }) => {
  const [homeTeam, awayTeam] = await Promise.all([
    userService.getUserById(fixture.homeTeam._id ?? fixture.homeTeam),
    userService.getUserById(fixture.awayTeam._id ?? fixture.awayTeam),
  ]);

  const homeTeamId = getObjectIdString(fixture.homeTeam);
  const isHome = homeTeamId === teamId.toString();
  const opponent = isHome ? awayTeam : homeTeam;

  return {
    id: fixture._id,
    matchday: fixture.matchday,
    scheduledDate: fixture.scheduledDate,
    status: fixture.status,
    isCompleted: fixture.isCompleted,
    isHome,
    opponent: buildUserSummary(opponent),
    homeTeamGoals: fixture.homeGoals,
    awayTeamGoals: fixture.awayGoals,
  };
};

const enrichUserUpcomingFixture = async ({ fixture, tournament, userId }) => {
  const [homeTeam, awayTeam] = await Promise.all([
    userService.getUserById(fixture.homeTeam._id ?? fixture.homeTeam),
    userService.getUserById(fixture.awayTeam._id ?? fixture.awayTeam),
  ]);

  const homeTeamId = getObjectIdString(fixture.homeTeam);
  const isHome = homeTeamId === userId.toString();
  const opponent = isHome ? awayTeam : homeTeam;

  return {
    id: fixture._id,
    tournamentId: tournament._id,
    tournamentName: tournament.name,
    matchday: fixture.matchday,
    scheduledDate: fixture.scheduledDate,
    status: fixture.status,
    isCompleted: fixture.isCompleted,
    isHome,
    opponent: buildUserSummary(opponent),
    homeGoals: fixture.homeGoals,
    awayGoals: fixture.awayGoals,
  };
};


// ============================================================
// CREATE TOURNAMENT
// ============================================================

export const createTournament = async ({ data }) => {
  const tournament = await tournamentDb.createTournament(data);

  await Group.findByIdAndUpdate(data.groupId, {
    $inc: { tournamentsCount: 1 },
    $set: { lastTournamentAt: new Date() },
  });

  await updateGroupMetrics(data.groupId);

  try {
    await scheduleTournamentJobs(tournament);
  } catch (error) {
    console.error(
      `[Scheduler] Failed to schedule jobs for tournament ${tournament._id}:`,
      error.message,
    );
  }

  return tournament;
};

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
  const totalMatchdays = Math.max(
    ...fixtures.map((fixture) => fixture.matchday),
  );

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

// ============================================================
// GET TOURNAMENT BY ID
// ============================================================

export const getTournamentById = async ({ tournamentId, userId = null }) => {
  const tournament = await ensureTournamentExists({ tournamentId });

  const participantDetails = await Promise.all(
    (tournament.participants ?? []).map(async (participant) => {
      try {
        const participantUserId = participant.userId ?? participant;
        const user = await userService.getUserById(participantUserId);

        return {
          userId: user._id,
          username: user.username,
          profilePicture: user.profilePicture ?? null,
          status: participant.status ?? "active",
        };
      } catch {
        return null;
      }
    }),
  );

  const participants = participantDetails.filter(Boolean);

  const userContext = userId
    ? (() => {
        const match = (tournament.participants ?? []).find(
          (participant) =>
            getObjectIdString(participant.userId ?? participant) ===
            userId.toString(),
        );

        return {
          isRegistered: Boolean(match),
          role: match?.status ?? null,
        };
      })()
    : {
        isRegistered: false,
        role: null,
      };

  return {
    ...tournament.toObject(),
    participants,
    userContext,
  };
};


// ============================================================
// GET GROUP TOURNAMENTS
// ============================================================

export const getGroupTournaments = async ({ groupId, status }) => {
  return tournamentDb.findTournamentsByGroup({ groupId, status });
};


// ============================================================
// GET ALL TOURNAMENTS
// ============================================================

export const getAllTournaments = async ({ page = 1, limit = 10, status }) => {
  const skip = (page - 1) * limit;
  const filter = {};

  if (status) {
    filter.status = status;
  }

  const [tournaments, total] = await Promise.all([
    tournamentDb.findAllTournaments(filter, { skip, limit }),
    tournamentDb.countTournaments(filter),
  ]);

  const totalPages = Math.ceil(total / limit);

  return {
    tournaments,
    pagination: {
      total,
      totalPages,
      currentPage: page,
      limit,
      hasNextPage: page < totalPages,
    },
  };
};


// ============================================================
// JOIN GROUP AND TOURNAMENT
// ============================================================

export const joinGroupAndTournament = async ({ tournamentId, userId }) => {
  const session = await mongoose.startSession();

  try {
    session.startTransaction();

    const tournament = await ensureTournamentExists({ tournamentId, session });
    const groupId = tournament.groupId._id ?? tournament.groupId;

    if (tournament.status !== "registration") {
      throw new BadRequestError("Tournament registration is closed");
    }

    if (new Date() > new Date(tournament.registrationDeadline)) {
      throw new BadRequestError("Registration deadline has passed");
    }

    const capacityCheck = await tournamentDb.checkTournamentCapacity(
      tournamentId,
      { session },
    );

    if (capacityCheck.isFull) {
      throw new BadRequestError("Tournament is full");
    }

    const alreadyRegistered = await tournamentDb.findUserInTournament(
      tournamentId,
      userId,
      { session },
    );

    if (alreadyRegistered) {
      throw new ConflictException("Already registered for this tournament");
    }

    const existingMembership = await membershipSchemaService.findMembership({
      userId,
      groupId,
      session,
    });

    if (!existingMembership) {
      await membershipSchemaService.createMembership(
        {
          userId,
          groupId,
          roleInGroup: "member",
          status: "active",
        },
        session,
      );

      await groupDb.updateGroup(
        groupId,
        { $inc: { totalMembers: 1 } },
        session,
      );

      const group = await groupDb.findGroupById(groupId, session);

      await userService.findAndUpdateUserById(
        userId,
        { $addToSet: { groups: group.name } },
        session,
      );
    } else if (existingMembership.status === "banned") {
      throw new ForbiddenError("You are banned from this group");
    } else if (existingMembership.status !== "active") {
      await membershipSchemaService.updateMembership(
        { userId, groupId },
        { status: "active" },
        { new: true },
        session,
      );

      await groupDb.updateGroup(
        groupId,
        { $inc: { totalMembers: 1 } },
        session,
      );
    }

    const updatedTournament = await tournamentDb.addParticipant(
      tournamentId,
      userId,
      { session },
    );

    if (!updatedTournament) {
      throw new ConflictException("Already registered for this tournament");
    }

    await Promise.all([
  userStatsService.getOrCreateUserStat(
    {
      userId,
      scopeType: "global",
    },
    { session },
  ),
  userStatsService.getOrCreateUserStat(
    {
      userId,
      scopeType: "group",
      groupId,
    },
    { session },
  ),
  userStatsService.getOrCreateUserStat(
    {
      userId,
      scopeType: "tournament",
      tournamentId,
    },
    { session },
  ),
]);

    await updateGroupMetrics(groupId, session);

    await session.commitTransaction();

    return {
      tournament: updatedTournament,
      message: "Successfully joined group and registered for tournament",
    };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
};


// ============================================================
// GET TOURNAMENT FIXTURES
// ============================================================

export const getTournamentFixtures = async ({ tournamentId }) => {
  await ensureTournamentExists({ tournamentId });

  const fixtures = await fixtureDb.getTournamentFixtures(tournamentId);

  return enrichFixturesWithTeams(fixtures, { includeRole: true });
};


// ============================================================
// GET MATCHDAY FIXTURES
// ============================================================

export const getMatchdayFixtures = async ({ tournamentId, matchday }) => {
  await ensureTournamentExists({ tournamentId });

  const fixtures = await fixtureDb.getMatchdayFixtures(tournamentId, matchday);

  return enrichFixturesWithTeams(fixtures);
};


// ============================================================
// GET TEAM FIXTURES
// ============================================================

export const getTeamFixtures = async ({ tournamentId, teamId }) => {
  const fixtures = await fixtureDb.getTeamFixtures(tournamentId, teamId);

  return Promise.all(
    fixtures.map((fixture) =>
      enrichTeamScopedFixture({
        fixture,
        teamId,
      }),
    ),
  );
};


// ============================================================
// CHECK TOURNAMENT READINESS
// ============================================================

export const checkTournamentReadiness = async ({
  tournamentId,
  session = null,
}) => {
  const tournament = await ensureTournamentExists({ tournamentId, session });

  const registeredParticipants = tournament.participants.filter(
    (participant) => participant.status === "registered",
  );

  const totalParticipants = registeredParticipants.length;
  const { maxParticipants } = tournament;
  const registrationClosed =
    new Date(tournament.registrationDeadline).getTime() <= Date.now();

  const readiness = {
    tournamentId: tournament._id,
    status: tournament.status,
    totalParticipants,
    maxParticipants,
    registrationClosed,
    isFull: totalParticipants === maxParticipants,
    hasMinimumParticipants: totalParticipants >= 2,
    canStart: false,
    reasons: [],
  };

  if (tournament.status !== "registration") {
    readiness.reasons.push("Tournament is not in registration phase");
    return readiness;
  }

  if (totalParticipants < 2) {
    readiness.reasons.push("At least 2 registered participants required");
  }

  if (!registrationClosed && totalParticipants < maxParticipants) {
    readiness.reasons.push("Registration still open and tournament is not full");
  }

  if (readiness.reasons.length === 0) {
    readiness.canStart = true;
  }

  return readiness;
};

// ============================================================
// GET UPCOMING FIXTURES FOR USER
// ============================================================

export const getUpcomingFixturesForUser = async ({ userId }) => {
  const tournaments = await tournamentDb.findUserTournaments(userId);
  const upcomingFixtures = [];

  for (const tournament of tournaments) {
    if (typeof fixtureDb.getUserUpcomingFixtures !== "function") {
      throw new BadRequestError(
        "getUserUpcomingFixtures is not implemented in fixtureSchemaService",
      );
    }

    const fixtures = await fixtureDb.getUserUpcomingFixtures(
      tournament._id,
      userId,
    );

    const enrichedFixtures = await Promise.all(
      fixtures.map((fixture) =>
        enrichUserUpcomingFixture({
          fixture,
          tournament,
          userId,
        }),
      ),
    );

    upcomingFixtures.push(...enrichedFixtures);
  }

  upcomingFixtures.sort(
    (a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate),
  );

  return upcomingFixtures;
};


// ============================================================
// GET TOURNAMENT PREVIEW
// ============================================================

export const getTournamentPreview = async ({ tournamentId, userId }) => {
  const tournament = await ensureTournamentExists({ tournamentId });

  const participant = tournament.participants.find(
    (entry) => getObjectIdString(entry.userId) === userId.toString(),
  );

  const myRole = participant ? participant.status : null;

  const [myStats, upcomingFixtures] = await Promise.all([
    userStatsService.getScopedUserStat({
      userId,
      scopeType: "tournament",
      tournamentId,
    }),
    fixtureDb.getUpcomingFixtures(tournamentId),
  ]);

  const nextMatchRaw = upcomingFixtures[0] ?? null;
  let nextMatch = null;

  if (nextMatchRaw) {
    const homeTeamId = getObjectIdString(nextMatchRaw.homeTeam);
    const awayTeamId = getObjectIdString(nextMatchRaw.awayTeam);

    const opponentId =
      homeTeamId === userId.toString() ? awayTeamId : homeTeamId;

    const opponent = await userService.getUserById(opponentId);

    nextMatch = {
      id: nextMatchRaw._id,
      matchday: nextMatchRaw.matchday,
      scheduledDate: nextMatchRaw.scheduledDate,
      isHome: homeTeamId === userId.toString(),
      opponent: buildUserSummary(opponent),
    };
  }

  return {
    tournament: {
      id: tournament._id,
      name: tournament.name,
      status: tournament.status,
      type: tournament.type,
      currentMatchday: tournament.currentMatchday,
      totalMatchdays: tournament.totalMatchdays,
      startDate: tournament.startDate,
      rules: tournament.rules,
    },
    userContext: {
      role: myRole,
      isRegistered: Boolean(myRole),
      stats: myStats
        ? {
            matchesPlayed: myStats.matchesPlayed,
            wins: myStats.matchesWon,
            draws: myStats.matchesDrawn,
            losses: myStats.matchesLost,
            goalsFor: myStats.goalsFor,
            goalsAgainst: myStats.goalsAgainst,
            goalDifference: myStats.goalDifference,
            points: myStats.points,
            cleanSheets: myStats.cleanSheets,
            form: myStats.form,
          }
        : {
            matchesPlayed: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
            cleanSheets: 0,
            form: [],
          },
    },
    nextMatch,
  };
};

// ============================================================
// UPDATE TOURNAMENT STATUS
// ============================================================

export const updateTournamentStatus = async ({ tournamentId, newStatus }) => {
  const tournament = await ensureTournamentExists({ tournamentId });

  const oldStatus = tournament.status;
  tournament.status = newStatus;

  await tournament.save();

  const groupId = tournament.groupId._id ?? tournament.groupId;

  if (oldStatus !== "ongoing" && newStatus === "ongoing") {
    await Group.findByIdAndUpdate(groupId, {
      $inc: { activeTournamentsCount: 1 },
      $set: { lastTournamentAt: new Date() },
    });
  }

  if (oldStatus === "ongoing" && newStatus === "completed") {
    await Group.findByIdAndUpdate(groupId, {
      $inc: { activeTournamentsCount: -1 },
    });
  }

  await cache.deleteByPattern(`tournament:${tournamentId}:*`);
  await updateGroupMetrics(groupId);

  return tournament;
};