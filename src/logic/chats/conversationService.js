import mongoose from "mongoose";
import ChatRoom from "../../models/chatRoomSchema.js";
import Message from "../../models/messageSchema.js";
import Group from "../../groupLogic/groupSchema.js";
import * as membershipService from "../../groupLogic/membershipService.js";
import * as tournamentService from "../../tournamentLogic/tournamentService.js";
import * as userService from "../../user/userService.js";
import { NotFoundException } from "../../lib/classes/errorClasses.js";

const normalizeAvatar = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.url) return value.url;
  return null;
};

const countUnreadForRoom = async ({ chatRoomId, userId }) => {
  return Message.countDocuments({
    chatRoom: chatRoomId,
    isDeleted: { $ne: true },
    deletedFor: { $ne: userId },
    sender: { $ne: userId },
    readBy: { $ne: userId },
  });
};

const buildGroupConversationItem = async ({ room, userId }) => {
  const group = await Group.findById(room.contextId)
    .populate("avatar", "url")
    .lean();

  if (!group || !group.isActive) {
    return null;
  }

  const membership = await membershipService.findMembership({
    userId,
    groupId: group._id,
  });

  if (!membership || membership.status !== "active") {
    return null;
  }

  let activeTournament = null;

  try {
    const activeTournaments = await tournamentService.getGroupTournaments(
      group._id,
      "ongoing",
    );

    const tournament = activeTournaments?.[0];
    if (tournament) {
      activeTournament = {
        id: tournament._id.toString(),
        name: tournament.name,
        status: tournament.status,
      };
    }
  } catch {
    activeTournament = null;
  }

  const unreadCount = await countUnreadForRoom({
    chatRoomId: room._id,
    userId,
  });

  return {
    chatRoomId: room._id.toString(),
    type: "group",
    title: group.name,
    avatarUrl: normalizeAvatar(group.avatar),
    lastMessage: room.lastMessageAt
      ? {
          text: room.lastMessagePreview || "",
          createdAt: room.lastMessageAt,
        }
      : null,
    unreadCount,
    isMuted: false,
    isPinned: false,
    groupMeta: {
      groupId: group._id.toString(),
      totalMembers: group.totalMembers || 0,
      myRole: membership.roleInGroup,
      activeTournament,
    },
  };
};

const buildDirectConversationItem = async ({ room, userId }) => {
  const otherParticipantId = (room.participants || [])
    .map((id) => id.toString())
    .find((id) => id !== userId.toString());

  if (!otherParticipantId) {
    return null;
  }

  const otherUser = await userService.findUserById(otherParticipantId);
  if (!otherUser) {
    return null;
  }

  const unreadCount = await countUnreadForRoom({
    chatRoomId: room._id,
    userId,
  });

  return {
    chatRoomId: room._id.toString(),
    type: "direct",
    title: otherUser.username || "Unknown User",
    avatarUrl: normalizeAvatar(otherUser.profilePicture),
    lastMessage: room.lastMessageAt
      ? {
          text: room.lastMessagePreview || "",
          createdAt: room.lastMessageAt,
        }
      : null,
    unreadCount,
    isMuted: false,
    isPinned: false,
    directMeta: {
      userId: otherUser._id.toString(),
      username: otherUser.username,
      isOnline: false, // hook up later from socket/presence
    },
  };
};

class ConversationService {
  async getInboxForUser({ userId }) {
    const rooms = await ChatRoom.find({
      participants: new mongoose.Types.ObjectId(userId),
    })
      .sort({ lastMessageAt: -1 })
      .lean();

    const items = [];

    for (const room of rooms) {
      if (room.contextType === "group") {
        const item = await buildGroupConversationItem({ room, userId });
        if (item) items.push(item);
        continue;
      }

      if (room.contextType === "direct") {
        const item = await buildDirectConversationItem({ room, userId });
        if (item) items.push(item);
      }
    }

    return {
      items,
    };
  }

  async getConversationDetail({ chatRoomId, userId }) {
    const room = await ChatRoom.findById(chatRoomId).lean();

    if (!room) {
      throw new NotFoundException("Conversation not found");
    }

    const isParticipant = (room.participants || [])
      .map((id) => id.toString())
      .includes(userId.toString());

    if (!isParticipant) {
      throw new NotFoundException("Conversation not found");
    }

    if (room.contextType === "group") {
      const group = await Group.findById(room.contextId)
        .populate("avatar", "url")
        .lean();

      if (!group || !group.isActive) {
        throw new NotFoundException("Group not found");
      }

      const membership = await membershipService.findMembership({
        userId,
        groupId: group._id,
      });

      let activeTournament = null;

      try {
        const activeTournaments = await tournamentService.getGroupTournaments(
          group._id,
          "ongoing",
        );

        const tournament = activeTournaments?.[0];
        if (tournament) {
          activeTournament = {
            id: tournament._id.toString(),
            name: tournament.name,
            status: tournament.status,
          };
        }
      } catch {
        activeTournament = null;
      }

      return {
        conversation: {
          id: room._id.toString(),
          type: "group",
          title: group.name,
          avatarUrl: normalizeAvatar(group.avatar),
          isMuted: false,
        },
        groupMeta: {
          groupId: group._id.toString(),
          totalMembers: group.totalMembers || 0,
          myRole: membership?.roleInGroup || "member",
          activeTournament,
        },
      };
    }

    const otherParticipantId = (room.participants || [])
      .map((id) => id.toString())
      .find((id) => id !== userId.toString());

    if (!otherParticipantId) {
      throw new NotFoundException("Direct conversation is invalid");
    }

    const otherUser = await userService.findUserById(otherParticipantId);
    if (!otherUser) {
      throw new NotFoundException("User not found");
    }

    return {
      conversation: {
        id: room._id.toString(),
        type: "direct",
        title: otherUser.username || "Unknown User",
        avatarUrl: normalizeAvatar(otherUser.profilePicture),
        isMuted: false,
      },
      directMeta: {
        userId: otherUser._id.toString(),
        username: otherUser.username,
        isOnline: false,
      },
    };
  }
}

export default new ConversationService();