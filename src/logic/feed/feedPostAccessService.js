import {
  BadRequestError,
  ForbiddenError,
  NotFoundException,
} from "../../lib/classes/errorClasses.js";
import * as groupService from "../../group/groupService.js";
import * as membershipService from "../../group/membershipService.js";
import * as tournamentService from "../../tournament/tournamentService.js";

const isSameId = (a, b) => String(a) === String(b);

const ensureUserId = (userId) => {
  if (!userId) {
    throw new BadRequestError("userId is required.");
  }
};

const ensurePost = (post) => {
  if (!post) {
    throw new NotFoundException("Post not found.");
  }
};

export const assertCanCreatePostInContext = async ({
  userId,
  contextType,
  contextId,
}) => {
  ensureUserId(userId);

  if (!contextType) {
    throw new BadRequestError("contextType is required.");
  }

  if (contextType === "general") {
    return true;
  }

  if (!contextId) {
    throw new BadRequestError(
      "contextId is required when contextType is not 'general'.",
    );
  }

  if (contextType === "group") {
    const group = await groupService.findById?.(contextId);

    if (!group) {
      throw new NotFoundException("Group not found.");
    }

    const membership = await membershipService.findMembership?.({
      userId,
      groupId: contextId,
    });

    if (!membership || membership.status !== "active") {
      throw new ForbiddenError("You must be an active member of this group.");
    }

    return true;
  }

  if (contextType === "tournament") {
    const tournament = await tournamentService.getTournamentById?.(contextId);

    if (!tournament) {
      throw new NotFoundException("Tournament not found.");
    }

    const isParticipant = Array.isArray(tournament.participants)
      ? tournament.participants.some((participant) =>
          isSameId(participant.userId ?? participant._id, userId),
        )
      : false;

    if (!isParticipant) {
      throw new ForbiddenError(
        "You must be a participant in this tournament to post here.",
      );
    }

    return true;
  }

  if (contextType === "match") {
    const match = await tournamentService.getFixtureById?.(contextId);

    if (!match) {
      throw new NotFoundException("Match not found.");
    }

    const participantIds = [
      match.homeTeam?._id ?? match.homeTeam?.id ?? match.homeTeam,
      match.awayTeam?._id ?? match.awayTeam?.id ?? match.awayTeam,
    ].filter(Boolean);

    const isParticipant = participantIds.some((id) => isSameId(id, userId));

    if (!isParticipant) {
      throw new ForbiddenError(
        "You must be a participant in this match to post here.",
      );
    }

    return true;
  }

  throw new BadRequestError("Unsupported contextType.");
};

export const assertCanViewPost = async ({ userId, post }) => {
  ensurePost(post);

  if (post.status === "deleted") {
    throw new NotFoundException("Post not found.");
  }

  if (post.status === "hidden" || post.status === "flagged") {
    if (!userId || !isSameId(post.author, userId)) {
      throw new ForbiddenError("You do not have access to this post.");
    }
    return true;
  }

  if (post.visibility === "public") {
    return true;
  }

  ensureUserId(userId);

  if (post.visibility === "private") {
    if (!isSameId(post.author, userId)) {
      throw new ForbiddenError("You do not have access to this post.");
    }
    return true;
  }

  if (post.visibility === "group_members") {
    if (post.contextType !== "group" || !post.contextId) {
      throw new ForbiddenError("Invalid group-restricted post.");
    }

    const membership = await membershipService.findMembership?.({
      userId,
      groupId: post.contextId,
    });

    if (!membership || membership.status !== "active") {
      throw new ForbiddenError("Only group members can view this post.");
    }

    return true;
  }

  if (post.visibility === "tournament_participants") {
    if (post.contextType !== "tournament" || !post.contextId) {
      throw new ForbiddenError("Invalid tournament-restricted post.");
    }

    const tournament = await tournamentService.getTournamentById?.(
      post.contextId,
    );

    if (!tournament) {
      throw new NotFoundException("Tournament not found.");
    }

    const isParticipant = Array.isArray(tournament.participants)
      ? tournament.participants.some((participant) =>
          isSameId(participant.userId ?? participant._id, userId),
        )
      : false;

    if (!isParticipant) {
      throw new ForbiddenError(
        "Only tournament participants can view this post.",
      );
    }

    return true;
  }

  throw new ForbiddenError("You do not have access to this post.");
};

export const assertCanModifyPost = async ({ userId, post }) => {
  ensureUserId(userId);
  ensurePost(post);

  if (post.status === "deleted") {
    throw new NotFoundException("Post not found.");
  }

  if (!isSameId(post.author, userId)) {
    throw new ForbiddenError("You are not allowed to modify this post.");
  }

  return true;
};

export const assertCanCommentOnPost = async ({ userId, post }) => {
  ensureUserId(userId);
  await assertCanViewPost({ userId, post });

  if (post.status !== "active") {
    throw new ForbiddenError("Comments are not allowed on this post.");
  }

  return true;
};

export const assertCanReactToPost = async ({ userId, post }) => {
  ensureUserId(userId);
  await assertCanViewPost({ userId, post });

  if (post.status !== "active") {
    throw new ForbiddenError("Reactions are not allowed on this post.");
  }

  return true;
};
