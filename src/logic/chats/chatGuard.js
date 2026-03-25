import { ForbiddenError } from "../../lib/classes/errorClasses.js";
import * as membershipService from "../../groupLogic/membershipService.js";
import mongoose from "mongoose";

export const ensureChatAccess = async ({ chatRoom, userId }) => {
  if (!chatRoom) {
    throw new ForbiddenError("Chat room not found");
  }

  const normalizedUserId =
    userId instanceof mongoose.Types.ObjectId
      ? userId
      : new mongoose.Types.ObjectId(userId);

  // -----------------------------
  // GROUP CHAT
  // -----------------------------

  if (chatRoom.contextType === "group") {
    const membership = await membershipService.findMembership({
      userId: normalizedUserId,
      groupId: chatRoom.contextId,
      status: "active",
    });

    if (!membership) {
      throw new ForbiddenError("You are not an active member of this group");
    }

    return true;
  }

  // -----------------------------
  // DIRECT CHAT
  // -----------------------------
  if (
    !Array.isArray(chatRoom.participants) ||
    !chatRoom.participants.some((p) => p.equals(normalizedUserId))
  ) {
    throw new ForbiddenError("You are not a participant of this chat");
  }

  return true;
};
