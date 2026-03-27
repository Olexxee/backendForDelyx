import { generateLeagueTable } from "../tournamentLogic/leagueTableService.js";

const mapTournamentType = (type) => {
  if (type === "cup") return "knockout";
  return type;
};

const mapParticipantStatus = (status) => {
  switch (status) {
    case "withdrawn":
      return "withdrawn";
    case "registered":
    case "confirmed":
    default:
      return "active";
  }
};

const buildViewerContext = ({ tournament, participantEntry, viewerId }) => {
  const now = new Date();

  const isRegistered = Boolean(participantEntry);
  const participantId = participantEntry?.userId?.toString?.() || null;

  const registrationStillOpen =
    tournament.status === "registration" &&
    tournament.registrationDeadline &&
    new Date(tournament.registrationDeadline) > now;

  const hasCapacity = tournament.currentParticipants < tournament.maxParticipants;

  return {
    isRegistered,
    role:
      tournament.createdBy?.toString?.() === viewerId?.toString?.()
        ? "creator"
        : isRegistered
          ? "participant"
          : null,
    participantId,
    canJoin: Boolean(viewerId && !isRegistered && registrationStillOpen && hasCapacity),
    canLeave: Boolean(viewerId && isRegistered && tournament.status === "registration"),
  };
};

export const serializeParticipant = ({ participant, user }) => ({
  id: participant.userId?.toString?.() || user?._id?.toString?.() || "",
  username: user?.username || user?.name || "Unknown User",
  profilePicture: user?.profilePicture || null,
  status: mapParticipantStatus(participant.status),
  isAdmin: false,
});

export const serializeFixture = ({ fixture, homeUser, awayUser }) => ({
  id: fixture._id?.toString?.() || "",
  matchday: fixture.matchday,
  status: fixture.status,
  scheduledDate: fixture.scheduledDate,
  homeParticipant: {
    id: homeUser?._id?.toString?.() || fixture.homeTeam?.toString?.() || "",
    username: homeUser?.username || homeUser?.name || "Unknown User",
    profilePicture: homeUser?.profilePicture || null,
    status: "active",
  },
  awayParticipant: {
    id: awayUser?._id?.toString?.() || fixture.awayTeam?.toString?.() || "",
    username: awayUser?.username || awayUser?.name || "Unknown User",
    profilePicture: awayUser?.profilePicture || null,
    status: "active",
  },
  homeScore: fixture.homeGoals ?? 0,
  awayScore: fixture.awayGoals ?? 0,
});

export const serializeStandingRow = (row) => ({
  participantId: row.userId?.toString?.() || row.id?.toString?.() || "",
  participantName: row.username || row.name || "Unknown User",
  profilePicture: row.profilePicture || null,
  position: row.position,
  played: row.played,
  wins: row.wins,
  draws: row.draws,
  losses: row.losses,
  points: row.points,
});

export const serializeTournamentSummary = ({ tournament, viewerId = null }) => {
  const participantEntry =
    viewerId
      ? tournament.participants?.find(
          (p) =>
            p.userId?.toString?.() === viewerId?.toString?.() &&
            p.status !== "withdrawn",
        )
      : null;

  return {
    id: tournament._id?.toString?.() || "",
    name: tournament.name,
    type: mapTournamentType(tournament.type),
    status: tournament.status,
    maxParticipants: tournament.maxParticipants,
    participantCount: tournament.currentParticipants ?? tournament.participants?.length ?? 0,
    startDate: tournament.startDate,
    currentMatchday: tournament.currentMatchday ?? 0,
    totalMatchdays: tournament.totalMatchdays ?? 0,
    viewerIsRegistered: Boolean(participantEntry),
  };
};

export const serializeTournamentDetail = ({
  tournament,
  participants = [],
  fixtures = [],
  standings = [],
  viewerId = null,
}) => {
  const participantEntry =
    viewerId
      ? tournament.participants?.find(
          (p) =>
            p.userId?.toString?.() === viewerId?.toString?.() &&
            p.status !== "withdrawn",
        )
      : null;

  const viewerContext = buildViewerContext({
    tournament,
    participantEntry,
    viewerId,
  });

  const winnerRow =
    tournament.status === "completed" && standings.length > 0 ? standings[0] : null;

  return {
    id: tournament._id?.toString?.() || "",
    name: tournament.name,
    groupId: tournament.groupId?.toString?.() || "",
    createdBy: tournament.createdBy?.toString?.() || "",
    type: mapTournamentType(tournament.type),
    description: tournament.description || "",
    status: tournament.status,
    isRegistrationOpen:
      tournament.status === "registration" &&
      tournament.registrationDeadline &&
      new Date(tournament.registrationDeadline) > new Date(),
    maxParticipants: tournament.maxParticipants,
    participantCount: tournament.currentParticipants ?? tournament.participants?.length ?? 0,
    participants,
    registrationDeadline: tournament.registrationDeadline,
    startDate: tournament.startDate,
    endDate: tournament.endDate,
    tournamentCode: tournament.tournamentCode,
    settings: {
      pointsForWin: tournament.settings?.pointsForWin ?? 3,
      pointsForDraw: tournament.settings?.pointsForDraw ?? 1,
      pointsForLoss: tournament.settings?.pointsForLoss ?? 0,
      rounds: tournament.settings?.rounds ?? "single",
    },
    progress: {
      totalMatches: tournament.totalMatches ?? 0,
      completedMatches: tournament.completedMatches ?? 0,
      currentMatchday: tournament.currentMatchday ?? 0,
      totalMatchdays: tournament.totalMatchdays ?? 0,
    },
    viewerContext,
    fixtures,
    standings,
    outcome: {
      winner: winnerRow
        ? {
            participantId: winnerRow.participantId,
            username: winnerRow.participantName,
            profilePicture: winnerRow.profilePicture || null,
          }
        : null,
    },
    createdAt: tournament.createdAt,
    updatedAt: tournament.updatedAt,
  };
};

export const buildTournamentStandings = async ({
  tournament,
  getUsersByIds,
}) => {
  const supportsStandings =
    tournament.type === "league" || tournament.type === "hybrid";

  if (!supportsStandings) return [];

  const result = await generateLeagueTable(tournament._id);
  const rawTable = result?.table;
  if (!rawTable?.length) return [];

  const ids = rawTable.map((row) => row.userId?.toString?.()).filter(Boolean);
  const users = await getUsersByIds(ids);

  const userMap = new Map(users.map((user) => [user._id.toString(), user]));

  return rawTable.map((row) => {
    const user = userMap.get(row.userId?.toString?.());
    return serializeStandingRow({
      ...row,
      username: user?.username || user?.name || row.username,
      profilePicture: user?.profilePicture || null,
    });
  });
};