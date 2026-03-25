export const serializeUser = (user, userStats = []) => {
  const tournaments = userStats.map((stats) => ({
    tournamentId: stats.tournamentId._id ?? stats.tournamentId,
    tournamentName: stats.tournamentId.name ?? "Unknown",
    matchesPlayed: stats.matchesPlayed,
    wins: stats.wins,
    losses: stats.losses,
    draws: stats.draws,
    goalsScored: stats.goalsScored,
    goalsConceded: stats.goalsConceded,
    points: stats.points,
    rank: stats.rank,
    fixtures: stats.fixtures.map((f) => ({
      fixtureId: f.fixtureId,
      opponent: f.opponent?.username ?? "Unknown",
      opponentId: f.opponent?._id ?? f.opponent,
      homeOrAway: f.homeOrAway,
      goalsFor: f.goalsFor,
      goalsAgainst: f.goalsAgainst,
      result: f.result,
      matchday: f.matchday,
      scheduledDate: f.scheduledDate,
      status: f.status,
    })),
  }));

  return {
    id: user._id.toString(),
    email: user.email,
    username: user.username ?? null,
    name: user.name ?? null,
    profilePicture: user.profilePicture,
    role: user.role,
    verified: user.verified,
    isActive: user.isActive,
    bio: user.bio ?? null,
    // Group-related info
    groupsJoinedCount: user.groupsJoinedCount ?? 0,
    groupsCreatedCount: user.groupsCreatedCount ?? 0,
    adminGroupsCount: user.adminGroupsCount ?? 0,
    groups: user.groups ?? [],
    // Tournament stats
    tournaments,
    // Aggregate stats
    totalMatchesPlayed: tournaments.reduce(
      (acc, t) => acc + t.matchesPlayed,
      0,
    ),
    totalWins: tournaments.reduce((acc, t) => acc + t.wins, 0),
    totalLosses: tournaments.reduce((acc, t) => acc + t.losses, 0),
    totalDraws: tournaments.reduce((acc, t) => acc + t.draws, 0),
    totalGoalsScored: tournaments.reduce((acc, t) => acc + t.goalsScored, 0),
    totalGoalsConceded: tournaments.reduce(
      (acc, t) => acc + t.goalsConceded,
      0,
    ),
  };
};

export const serializeGroup = (group) => {
  return {
    id: group._id.toString(),
    name: group.name,
    bio: group.bio || null,
    avatar: group.avatar?.url || null,
    privacy: group.privacy,
    joinCode: group.joinCode || null,
    createdBy: group.createdBy?._id?.toString() || group.createdBy?.toString(),
    createdByName: group.createdBy?.username || null, // optional
    isActive: group.isActive,
    totalMembers: group.totalMembers || 1,
    tournamentsCount: group.tournamentsCount || 0,
    activeTournamentsCount: group.activeTournamentsCount || 0,
    chatRoomId:
      group.chatRoom?._id?.toString() || group.chatRoom?.toString() || null,
    lastTournamentAt: group.lastTournamentAt || null,
    createdAt: group.createdAt,
    updatedAt: group.updatedAt,
  };
};
