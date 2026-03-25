import UserStat from "./userStatSchema.js";
import { BadRequestError } from "../lib/classes/errorClasses.js";

const SCOPE = {
  GLOBAL: "global",
  GROUP: "group",
  TOURNAMENT: "tournament",
};

const RESULT = {
  WIN: "W",
  DRAW: "D",
  LOSS: "L",
};

const resolveScopeId = ({ scopeType, groupId = null, tournamentId = null }) => {
  switch (scopeType) {
    case SCOPE.GLOBAL:
      return null;
    case SCOPE.GROUP:
      return groupId;
    case SCOPE.TOURNAMENT:
      return tournamentId;
    default:
      throw new BadRequestError(`Invalid scopeType: ${scopeType}`);
  }
};

const validateScopeInput = ({
  scopeType,
  groupId = null,
  tournamentId = null,
}) => {
  if (!Object.values(SCOPE).includes(scopeType)) {
    throw new BadRequestError(`Invalid scopeType: ${scopeType}`);
  }

  if (scopeType === SCOPE.GROUP && !groupId) {
    throw new BadRequestError("groupId is required for group scope");
  }

  if (scopeType === SCOPE.TOURNAMENT && !tournamentId) {
    throw new BadRequestError("tournamentId is required for tournament scope");
  }
};

const getMatchOutcome = ({ goalsFor, goalsAgainst }) => {
  if (goalsFor > goalsAgainst) {
    return {
      result: RESULT.WIN,
      points: 3,
      isWin: true,
      isDraw: false,
      isLoss: false,
    };
  }

  if (goalsFor === goalsAgainst) {
    return {
      result: RESULT.DRAW,
      points: 1,
      isWin: false,
      isDraw: true,
      isLoss: false,
    };
  }

  return {
    result: RESULT.LOSS,
    points: 0,
    isWin: false,
    isDraw: false,
    isLoss: true,
  };
};

const updateStreaks = (stat, result) => {
  if (result === RESULT.WIN) {
    stat.currentWinStreak += 1;
    stat.currentUnbeatenStreak += 1;
    return;
  }

  if (result === RESULT.DRAW) {
    stat.currentWinStreak = 0;
    stat.currentUnbeatenStreak += 1;
    return;
  }

  stat.currentWinStreak = 0;
  stat.currentUnbeatenStreak = 0;
};

const recalculateRankScore = (stat) => {
  stat.rankScore =
    stat.points * 10 +
    stat.matchesWon * 3 +
    stat.goalDifference * 2 +
    stat.cleanSheets;
};

export const getOrCreateUserStat = async (
  { userId, scopeType, groupId = null, tournamentId = null },
  options = {},
) => {
  const { session } = options;

  validateScopeInput({ scopeType, groupId, tournamentId });

  const scopeId = resolveScopeId({ scopeType, groupId, tournamentId });

  return UserStat.findOneAndUpdate(
    {
      userId,
      scopeType,
      scopeId,
    },
    {
      $setOnInsert: {
        userId,
        scopeType,
        scopeId,
      },
    },
    {
      upsert: true,
      new: true,
      session: session || null,
    },
  );
};

export const ensureTournamentStatsForParticipants = async (
  { participantIds, tournamentId },
  options = {},
) => {
  const { session } = options;

  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return [];
  }

  return Promise.all(
    participantIds.map((userId) =>
      getOrCreateUserStat(
        {
          userId,
          scopeType: SCOPE.TOURNAMENT,
          tournamentId,
        },
        { session },
      ),
    ),
  );
};

export const applyMatchResultToScope = async (
  {
    userId,
    scopeType,
    groupId = null,
    tournamentId = null,
    goalsFor,
    goalsAgainst,
    playedAt = new Date(),
  },
  options = {},
) => {
  const { session } = options;

  validateScopeInput({ scopeType, groupId, tournamentId });

  const scopeId = resolveScopeId({ scopeType, groupId, tournamentId });

  let stat = await UserStat.findOne({
    userId,
    scopeType,
    scopeId,
  }).session(session || null);

  if (!stat) {
    stat = await getOrCreateUserStat(
      { userId, scopeType, groupId, tournamentId },
      { session },
    );
  }

  const { result, points, isWin, isDraw, isLoss } = getMatchOutcome({
    goalsFor,
    goalsAgainst,
  });

  stat.matchesPlayed += 1;
  stat.matchesWon += isWin ? 1 : 0;
  stat.matchesDrawn += isDraw ? 1 : 0;
  stat.matchesLost += isLoss ? 1 : 0;

  stat.goalsFor += goalsFor;
  stat.goalsAgainst += goalsAgainst;
  stat.points += points;
  stat.cleanSheets += goalsAgainst === 0 ? 1 : 0;
  stat.lastMatchAt = playedAt;
  stat.form = [...stat.form, result].slice(-5);

  updateStreaks(stat, result);
  recalculateRankScore(stat);

  await stat.save({ session });

  return stat;
};

export const updateParticipantStatsForFixture = async (
  {
    tournamentId,
    groupId,
    homeUserId,
    awayUserId,
    homeGoals,
    awayGoals,
    playedAt = new Date(),
  },
  options = {},
) => {
  const { session } = options;

  if (!groupId) {
    throw new BadRequestError("groupId is required");
  }

  await Promise.all([
    applyMatchResultToScope(
      {
        userId: homeUserId,
        scopeType: SCOPE.GLOBAL,
        goalsFor: homeGoals,
        goalsAgainst: awayGoals,
        playedAt,
      },
      { session },
    ),
    applyMatchResultToScope(
      {
        userId: homeUserId,
        scopeType: SCOPE.GROUP,
        groupId,
        goalsFor: homeGoals,
        goalsAgainst: awayGoals,
        playedAt,
      },
      { session },
    ),
    applyMatchResultToScope(
      {
        userId: homeUserId,
        scopeType: SCOPE.TOURNAMENT,
        tournamentId,
        goalsFor: homeGoals,
        goalsAgainst: awayGoals,
        playedAt,
      },
      { session },
    ),

    applyMatchResultToScope(
      {
        userId: awayUserId,
        scopeType: SCOPE.GLOBAL,
        goalsFor: awayGoals,
        goalsAgainst: homeGoals,
        playedAt,
      },
      { session },
    ),
    applyMatchResultToScope(
      {
        userId: awayUserId,
        scopeType: SCOPE.GROUP,
        groupId,
        goalsFor: awayGoals,
        goalsAgainst: homeGoals,
        playedAt,
      },
      { session },
    ),
    applyMatchResultToScope(
      {
        userId: awayUserId,
        scopeType: SCOPE.TOURNAMENT,
        tournamentId,
        goalsFor: awayGoals,
        goalsAgainst: homeGoals,
        playedAt,
      },
      { session },
    ),
  ]);
};

export const recordTournamentCompletion = async (
  { participantIds, winnerId = null, tournamentId, groupId = null },
  options = {},
) => {
  const { session } = options;

  if (!Array.isArray(participantIds) || participantIds.length === 0) {
    return [];
  }

  return Promise.all(
    participantIds.flatMap((userId) => {
      const isWinner = String(userId) === String(winnerId);

      return [
        incrementTournamentPlayed(
          {
            userId,
            scopeType: SCOPE.GLOBAL,
            isWinner,
          },
          { session },
        ),
        incrementTournamentPlayed(
          {
            userId,
            scopeType: SCOPE.GROUP,
            groupId,
            isWinner,
          },
          { session },
        ),
        incrementTournamentPlayed(
          {
            userId,
            scopeType: SCOPE.TOURNAMENT,
            tournamentId,
            isWinner,
          },
          { session },
        ),
      ];
    }),
  );
};

const incrementTournamentPlayed = async (
  { userId, scopeType, groupId = null, tournamentId = null, isWinner = false },
  options = {},
) => {
  const { session } = options;

  let stat = await getOrCreateUserStat(
    { userId, scopeType, groupId, tournamentId },
    { session },
  );

  stat.tournamentsPlayed += 1;
  stat.tournamentsWon += isWinner ? 1 : 0;
  stat.tournamentsLost += isWinner ? 0 : 1;

  recalculateRankScore(stat);

  await stat.save({ session });

  return stat;
};

export const getScopedUserStat = async (
  { userId, scopeType, groupId = null, tournamentId = null },
  options = {},
) => {
  const { session } = options;

  validateScopeInput({ scopeType, groupId, tournamentId });

  const scopeId = resolveScopeId({ scopeType, groupId, tournamentId });

  return UserStat.findOne({
    userId,
    scopeType,
    scopeId,
  }).session(session || null);
};

export const getLeaderboardByScope = async (
  { scopeType, groupId = null, tournamentId = null, limit = 20 },
  options = {},
) => {
  const { session } = options;

  validateScopeInput({ scopeType, groupId, tournamentId });

  const scopeId = resolveScopeId({ scopeType, groupId, tournamentId });

  return UserStat.find({
    scopeType,
    scopeId,
  })
    .populate("userId", "username profilePicture")
    .sort({
      points: -1,
      goalDifference: -1,
      goalsFor: -1,
      rankScore: -1,
    })
    .limit(limit)
    .session(session || null);
};

export const deleteScopedUserStat = async (
  { userId, scopeType, groupId = null, tournamentId = null },
  options = {},
) => {
  const { session } = options;

  validateScopeInput({ scopeType, groupId, tournamentId });

  const scopeId = resolveScopeId({ scopeType, groupId, tournamentId });

  return UserStat.findOneAndDelete({
    userId,
    scopeType,
    scopeId,
  }).session(session || null);
};

export { SCOPE, RESULT };