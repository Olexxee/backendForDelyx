import mongoose from "mongoose";
import * as groupDb from "./gSchemaService.js";
import * as membershipService from "./membershipService.js";
import * as membershipCrud from "./membershipSchemaService.js";
import {
  BadRequestError,
  ForbiddenError,
  NotFoundException,
} from "../lib/classes/errorClasses.js";
import {
  getGroupHubShared,
  setGroupHubShared,
} from "../lib/cache/groupHubCache.js";

const resolveGroupHubQuickActions = ({ myRole, isMember }) => {
  const isAdmin = myRole === "admin";

  return {
    canCreateTournament: isAdmin,
    canManageGroup: isAdmin,
    canInviteMembers: isMember,
    canViewRequests: isAdmin,
  };
};

const serializeMembersPreview = (members = []) => {
  return members.map((member) => ({
    id: member.userId?._id ? String(member.userId._id) : null,
    username: member.userId?.username ?? null,
    avatarUrl: member.userId?.profilePicture ?? null,
    role: member.roleInGroup ?? "member",
    joinedAt: member.joinedAt ?? null,
  }));
};

const serializeActiveTournament = (tournament) => {
  if (!tournament) return null;

  return {
    id: String(tournament._id),
    name: tournament.name,
    status: tournament.status,
    type: tournament.type,
    currentParticipants: tournament.currentParticipants,
    maxParticipants: tournament.maxParticipants,
    currentMatchday: tournament.currentMatchday,
    totalMatchdays: tournament.totalMatchdays,
    completedMatches: tournament.completedMatches,
    totalMatches: tournament.totalMatches,
    registrationDeadline: tournament.registrationDeadline ?? null,
    startDate: tournament.startDate ?? null,
  };
};

const serializeSharedFragment = ({
  group,
  activeTournament,
  stats,
  membersPreview,
}) => {
  return {
    group: {
      id: String(group._id),
      chatRoomId: group.chatRoom?._id
        ? String(group.chatRoom._id)
        : group.chatRoom
          ? String(group.chatRoom)
          : null,
      name: group.name,
      description: group.bio ?? null,
      avatarUrl: group.banner?.url ?? null,
      privacy: group.privacy,
      totalMembers: group.totalMembers ?? 0,
      isMuted: false,
    },
    activeTournament: serializeActiveTournament(activeTournament),
    stats: {
      activeTournaments: stats.activeTournaments ?? 0,
      totalTournaments: stats.totalTournaments ?? 0,
      totalMessages: stats.totalMessages ?? 0,
      activeMembers7d: stats.activeMembers7d ?? 0,
    },
    membersPreview: serializeMembersPreview(membersPreview),
  };
};

export const getGroupHub = async ({ groupId, userId }) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw new BadRequestError("Invalid group id");
  }

  const group = await groupDb.findGroupHubBaseById(groupId);

  if (!group || !group.isActive) {
    throw new NotFoundException("Group not found");
  }

  const membership = await membershipService.findMembership({
    userId,
    groupId,
  });

  if (!membership && group.privacy !== "public") {
    throw new ForbiddenError("You are not a member of this group");
  }

  const myRole = membership?.roleInGroup ?? "member";
  const isMember = Boolean(membership);

  let sharedFragment = await getGroupHubShared(groupId);

  if (!sharedFragment) {
    const [membersPreview, activeTournament, stats] = await Promise.all([
      membershipCrud.getMemberPreview(groupId, 5),
      groupDb.findActiveTournamentSummary(groupId),
      groupDb.getGroupHubSharedStats({
        groupId,
        chatRoomId: group.chatRoom?._id ?? group.chatRoom,
        activeTournamentsCount: group.activeTournamentsCount ?? 0,
      }),
    ]);

    sharedFragment = serializeSharedFragment({
      group,
      activeTournament,
      stats,
      membersPreview,
    });

    await setGroupHubShared(groupId, sharedFragment, 60);
  }

  const quickActions = resolveGroupHubQuickActions({
    myRole,
    isMember,
  });

  return {
    ...sharedFragment,
    group: {
      ...sharedFragment.group,
      myRole,
    },
    quickActions,
  };
};
