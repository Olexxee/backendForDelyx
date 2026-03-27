import mongoose from "mongoose";
import * as fixtureDb from "../models/fixtureSchemaService.js";
import * as tournamentDb from "../models/tournamentSchemaService.js";
import * as userService from "../user/userService.js";
import * as userStatsService from "../user/statschemaService.js";
import {
  serializeTournamentSummary,
  serializeTournamentDetail,
  serializeParticipant,
  serializeFixture,
  buildTournamentStandings,
} from "../lib/tournamentSerializer.js";

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

  await updateGroupMetrics({ groupId: data.groupId });

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

 await updateGroupMetrics({ groupId: tournament.groupId._id || tournament.groupId, session });

  return {
    fixtures: createdFixtures,
    fixturesCount: createdFixtures.length,
    totalMatchdays,
  };
};

// ============================================================
// GET TOURNAMENT BY ID
// ============================================================

export const getTournamentById = async (tournamentId, viewerId = null) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);

  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  const participantIds =
    tournament.participants
      ?.map((participant) => participant.userId?.toString?.())
      .filter(Boolean) || [];

  const participantUsers = participantIds.length
    ? await Promise.all(
        participantIds.map((userId) => userService.findUserById(userId)),
      )
    : [];

  const participantUserMap = new Map(
    participantUsers
      .filter(Boolean)
      .map((user) => [user._id.toString(), user]),
  );

  const participants = (tournament.participants || []).map((participant) => {
    const user = participantUserMap.get(participant.userId?.toString?.());
    return serializeParticipant({ participant, user });
  });

  const fixtureResult = await fixtureService.getTournamentFixtures(tournamentId);
  const rawFixtures = fixtureResult?.fixtures || [];

  const fixtureUserIds = rawFixtures.flatMap((fixture) => [
    fixture.homeTeam?.toString?.(),
    fixture.awayTeam?.toString?.(),
  ]).filter(Boolean);

  const uniqueFixtureUserIds = [...new Set(fixtureUserIds)];
  const fixtureUsers = uniqueFixtureUserIds.length
    ? await Promise.all(
        uniqueFixtureUserIds.map((userId) => userService.findUserById(userId)),
      )
    : [];

  const fixtureUserMap = new Map(
    fixtureUsers
      .filter(Boolean)
      .map((user) => [user._id.toString(), user]),
  );

  const fixtures = rawFixtures.map((fixture) =>
    serializeFixture({
      fixture,
      homeUser: fixtureUserMap.get(fixture.homeTeam?.toString?.()),
      awayUser: fixtureUserMap.get(fixture.awayTeam?.toString?.()),
    }),
  );

  const standings = await buildTournamentStandings({
    tournament,
    getUsersByIds: async (ids) =>
      Promise.all(ids.map((id) => userService.findUserById(id))),
  });

  return serializeTournamentDetail({
    tournament,
    participants,
    fixtures,
    standings,
    viewerId,
  });
};


// ============================================================
// GET GROUP TOURNAMENTS
// ============================================================

export const getGroupTournaments = async (groupId, status, viewerId = null) => {
  const tournaments = await tournamentDb.findGroupTournaments(groupId, status);

  return tournaments.map((tournament) =>
    serializeTournamentSummary({
      tournament,
      viewerId,
    }),
  );
};


// ============================================================
// GET ALL TOURNAMENTS
// ============================================================

export const getAllTournaments = async ({ page = 1, limit = 10, status, viewerId = null }) => {
  const result = await tournamentDb.findAllTournaments({
    page,
    limit,
    status,
  });

  return {
    tournaments: result.tournaments.map((tournament) =>
      serializeTournamentSummary({
        tournament,
        viewerId,
      }),
    ),
    pagination: result.pagination,
  };
};

// ============================================================
// JOIN GROUP AND TOURNAMENT
// ============================================================

export const joinGroupAndTournament = async ({ tournamentId, userId }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);

  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  if (tournament.status !== "registration") {
    throw new BadRequestError("Tournament registration is closed");
  }

  if (new Date(tournament.registrationDeadline) < new Date()) {
    throw new BadRequestError("Registration deadline has passed");
  }

  if (tournament.currentParticipants >= tournament.maxParticipants) {
    throw new BadRequestError("Tournament is full");
  }

  const existingParticipant = tournament.participants.find(
    (participant) =>
      participant.userId?.toString() === userId.toString() &&
      participant.status !== "withdrawn",
  );

  if (existingParticipant) {
    throw new BadRequestError("You are already registered for this tournament");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      await groupService.joinGroup(tournament.groupId, userId, { session });

      const updatedTournament = await tournamentDb.addParticipant(
        tournamentId,
        userId,
        {
          session,
          participantStatus: "registered",
        },
      );

      if (!updatedTournament) {
        throw new BadRequestError("Failed to register for tournament");
      }
    });
  } finally {
    await session.endSession();
  }

  const serializedTournament = await getTournamentById(tournamentId, userId);

  return {
    message: "Successfully joined group and registered for tournament",
    tournament: serializedTournament,
  };
};

export const leaveTournament = async ({ tournamentId, userId }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);

  if (!tournament) {
    throw new NotFoundException("Tournament not found");
  }

  const participant = tournament.participants.find(
    (entry) =>
      entry.userId?.toString() === userId.toString() &&
      entry.status !== "withdrawn",
  );

  if (!participant) {
    throw new BadRequestError("You are not registered for this tournament");
  }

  if (tournament.status !== "registration") {
    throw new BadRequestError("You can only leave during registration");
  }

  if (new Date(tournament.registrationDeadline) < new Date()) {
    throw new BadRequestError("Registration deadline has passed");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const updatedTournament = await tournamentDb.removeParticipant(
        tournamentId,
        userId,
        { session },
      );

      if (!updatedTournament) {
        throw new NotFoundException("Tournament not found");
      }
    });
  } finally {
    await session.endSession();
  }

  const serializedTournament = await getTournamentById(tournamentId, userId);

  return {
    message: "Successfully left tournament",
    tournament: serializedTournament,
  };
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
  await updateGroupMetrics({ groupId });

  return tournament;
};