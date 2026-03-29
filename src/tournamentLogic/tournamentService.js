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
// CACHE HELPERS
// ============================================================

const CACHE_TTL = {
  tournament: 60 * 5,
  groupTournaments: 60 * 2,
  allTournaments: 60 * 2,
  fixtures: 60 * 10,
  readiness: 60,
};

const cacheKeys = {
  tournament: (id) => `tournament:${id}:detail`,
  groupTournaments: (groupId, status) =>
    `tournament:group:${groupId}:${status ?? "all"}`,
  allTournaments: (page, limit, status) =>
    `tournament:all:${page}:${limit}:${status ?? "all"}`,
  fixtures: (tournamentId) => `tournament:${tournamentId}:fixtures`,
  readiness: (tournamentId) => `tournament:${tournamentId}:readiness`,
};

const invalidateTournament = async (tournamentId, groupId = null) => {
  await cache.deleteByPattern(`tournament:${tournamentId}:*`);
  if (groupId) {
    await cache.deleteByPattern(`tournament:group:${groupId}:*`);
    await cache.deleteByPattern(`tournament:all:*`);
  }
};

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

const enrichFixtureWithTeams = async (fixture, { includeRole = false } = {}) => {
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
    homeTeam: buildUserSummary(homeTeam, includeRole ? { role: homeTeam.role } : {}),
    awayTeam: buildUserSummary(awayTeam, includeRole ? { role: awayTeam.role } : {}),
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

  await cache.deleteByPattern(`tournament:group:${data.groupId}:*`);
  await cache.deleteByPattern(`tournament:all:*`);

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

// ============================================================
// GET TOURNAMENT BY ID
// ============================================================

export const getTournamentById = async (tournamentId, viewerId = null) => {
  const cacheKey = cacheKeys.tournament(tournamentId);
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

  const participantIds =
    tournament.participants
      ?.map((p) => p.userId?.toString?.())
      .filter(Boolean) || [];

  const participantUsers = participantIds.length
    ? await Promise.all(
        participantIds.map((id) => userService.findUserById(id)),
      )
    : [];

  const participantUserMap = new Map(
    participantUsers.filter(Boolean).map((u) => [u._id.toString(), u]),
  );

  const participants = (tournament.participants || []).map((participant) => {
    const user = participantUserMap.get(participant.userId?.toString?.());
    return serializeParticipant({ participant, user });
  });

  // fixtureDb.getTournamentFixtures already populates homeTeam and awayTeam
  const rawFixtures = await fixtureDb.getTournamentFixtures(tournamentId);

  const fixtures = rawFixtures.map((fixture) =>
    serializeFixture({
      fixture,
      homeUser: fixture.homeTeam,
      awayUser: fixture.awayTeam,
    }),
  );

  const standings = await buildTournamentStandings({
    tournament,
    getUsersByIds: async (ids) =>
      Promise.all(ids.map((id) => userService.findUserById(id))),
  });

  const result = serializeTournamentDetail({
    tournament,
    participants,
    fixtures,
    standings,
    viewerId,
  });

  await cache.set(cacheKey, result, CACHE_TTL.tournament);

  return result;
};

// ============================================================
// GET GROUP TOURNAMENTS
// ============================================================

export const getGroupTournaments = async (groupId, status, viewerId = null) => {
  const cacheKey = cacheKeys.groupTournaments(groupId, status);
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const tournaments = await tournamentDb.findGroupTournaments(groupId, status);

  const result = tournaments.map((tournament) =>
    serializeTournamentSummary({ tournament, viewerId }),
  );

  await cache.set(cacheKey, result, CACHE_TTL.groupTournaments);

  return result;
};

// ============================================================
// GET ALL TOURNAMENTS
// ============================================================

export const getAllTournaments = async ({
  page = 1,
  limit = 10,
  status,
  viewerId = null,
}) => {
  const cacheKey = cacheKeys.allTournaments(page, limit, status);
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const result = await tournamentDb.findAllTournaments({ page, limit, status });

  const serialized = {
    tournaments: result.tournaments.map((tournament) =>
      serializeTournamentSummary({ tournament, viewerId }),
    ),
    pagination: result.pagination,
  };

  await cache.set(cacheKey, serialized, CACHE_TTL.allTournaments);

  return serialized;
};

// ============================================================
// JOIN GROUP AND TOURNAMENT
// ============================================================

export const joinGroupAndTournament = async ({ tournamentId, userId }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

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
    (p) =>
      p.userId?.toString() === userId.toString() &&
      p.status !== "withdrawn",
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
        { session, participantStatus: "registered" },
      );

      if (!updatedTournament) {
        throw new BadRequestError("Failed to register for tournament");
      }
    });
  } finally {
    await session.endSession();
  }

  await invalidateTournament(tournamentId, tournament.groupId);

  const serializedTournament = await getTournamentById(tournamentId, userId);

  return {
    message: "Successfully joined group and registered for tournament",
    tournament: serializedTournament,
  };
};

// ============================================================
// LEAVE TOURNAMENT
// ============================================================

export const leaveTournament = async ({ tournamentId, userId }) => {
  const tournament = await tournamentDb.findTournamentById(tournamentId);
  if (!tournament) throw new NotFoundException("Tournament not found");

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

  await invalidateTournament(tournamentId, tournament.groupId);

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

  const cacheKey = cacheKeys.fixtures(tournamentId);
  const cached = await cache.get(cacheKey);
  if (cached) return cached;

  const fixtures = await fixtureDb.getTournamentFixtures(tournamentId);
  const result = await enrichFixturesWithTeams(fixtures, { includeRole: true });

  await cache.set(cacheKey, result, CACHE_TTL.fixtures);

  return result;
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
    fixtures.map((fixture) => enrichTeamScopedFixture({ fixture, teamId })),
  );
};

// ============================================================
// CHECK TOURNAMENT READINESS
// ============================================================

export const checkTournamentReadiness = async ({
  tournamentId,
  session = null,
}) => {
  if (!session) {
    const cacheKey = cacheKeys.readiness(tournamentId);
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const tournament = await ensureTournamentExists({ tournamentId, session });

  const registeredParticipants = tournament.participants.filter(
    (p) => p.status === "registered",
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

  if (!session) {
    await cache.set(
      cacheKeys.readiness(tournamentId),
      readiness,
      CACHE_TTL.readiness,
    );
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
    const fixtures = await fixtureDb.getUserUpcomingFixtures(
      tournament._id,
      userId,
    );

    const enrichedFixtures = await Promise.all(
      fixtures.map((fixture) =>
        enrichUserUpcomingFixture({ fixture, tournament, userId }),
      ),
    );

    upcomingFixtures.push(...enrichedFixtures);
  }

  upcomingFixtures.sort(
    (a, b) => new Date(a.scheduledDate) - new Date(b.scheduledDate),
  );

  return upcomingFixtures;
};

// =============