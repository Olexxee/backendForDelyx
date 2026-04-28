import {
  BadRequestError,
  NotFoundException,
} from "../../lib/classes/errorClasses.js";
import { validator } from "../../lib/classes/validatorClass.js";
import {
  reactToTargetSchema,
  unreactToTargetSchema,
} from "./validation/feedReactionValidation.js";
import {
  countReactionsForTarget,
  deleteReaction,
  findReaction,
  upsertReaction,
} from "../../models/feedReactionDb.js";
import { findFeedPostById } from "../../models/feedPostDb.js";
import { findFeedCommentById } from "../../models/feedCommentDb.js";
import { publishDomainEvent } from "../../queues/publishDomainEvent.js";
import { EVENT_TYPES } from "../../event/eventTypes.js";

// ─── Internal Helpers ─────────────────────────────────────────────────────────

const ensureTargetExists = async ({ targetType, targetId }, options = {}) => {
  if (targetType === "post") {
    const post = await findFeedPostById(targetId, options);

    if (!post || post.status === "deleted") {
      throw new NotFoundException("Target post not found.");
    }

    return post;
  }

  if (targetType === "comment") {
    const comment = await findFeedCommentById(targetId, options);

    if (!comment || comment.status === "deleted") {
      throw new NotFoundException("Target comment not found.");
    }

    return comment;
  }

  throw new BadRequestError("Invalid target type.");
};

// ─── Core React / Unreact ─────────────────────────────────────────────────────

export const reactToTarget = async (payload, options = {}) => {
  const validated = validator.validate(reactToTargetSchema, payload);

  const target = await ensureTargetExists(validated, options);

  const existingReaction = await findReaction(
    {
      user: validated.user,
      targetType: validated.targetType,
      targetId: validated.targetId,
    },
    options,
  );

  if (existingReaction) {
    // Same reaction type — idempotent, nothing to do
    if (existingReaction.reactionType === validated.reactionType) {
      return existingReaction;
    }

    // Different type — update the reaction, no count change needed
    return upsertReaction(validated, options);
  }

  const reaction = await upsertReaction(validated, options);

  // Moved off the critical path. The worker handles:
  //   - incrementing the denormalised reactionsCount on the target
  //   - dispatching the reaction notification to the target's author
  const eventName =
    validated.targetType === "post"
      ? EVENT_TYPES.FEED_POST_REACTED
      : EVENT_TYPES.FEED_COMMENT_REACTED;

  await publishDomainEvent(eventName, {
    targetType: validated.targetType,
    targetId: String(validated.targetId),
    userId: String(validated.user),
    reactionType: validated.reactionType,
    // Pass the author of the target so the worker can send a notification
    // without a second DB lookup.
    targetAuthorId: String(target.author?._id ?? target.author),
  });

  return reaction;
};

export const unreactToTarget = async (payload, options = {}) => {
  const validated = validator.validate(unreactToTargetSchema, payload);

  const existingReaction = await findReaction(
    {
      user: validated.user,
      targetType: validated.targetType,
      targetId: validated.targetId,
    },
    options,
  );

  if (!existingReaction) {
    return null;
  }

  await deleteReaction(
    {
      user: validated.user,
      targetType: validated.targetType,
      targetId: validated.targetId,
    },
    options,
  );

  const eventName =
    validated.targetType === "post"
      ? EVENT_TYPES.FEED_POST_UNREACTED
      : EVENT_TYPES.FEED_COMMENT_UNREACTED;

  await publishDomainEvent(eventName, {
    targetType: validated.targetType,
    targetId: String(validated.targetId),
    userId: String(validated.user),
  });

  return existingReaction;
};

// ─── Convenience Wrappers ─────────────────────────────────────────────────────

export const reactToPost = async ({ user, postId }, options = {}) => {
  return reactToTarget(
    { user, targetType: "post", targetId: postId, reactionType: "like" },
    options,
  );
};

export const unreactToPost = async ({ user, postId }, options = {}) => {
  return unreactToTarget(
    { user, targetType: "post", targetId: postId },
    options,
  );
};

export const reactToComment = async ({ user, commentId }, options = {}) => {
  return reactToTarget(
    { user, targetType: "comment", targetId: commentId, reactionType: "like" },
    options,
  );
};

export const unreactToComment = async ({ user, commentId }, options = {}) => {
  return unreactToTarget(
    { user, targetType: "comment", targetId: commentId },
    options,
  );
};

// ─── Query Helpers ────────────────────────────────────────────────────────────

export const hasReaction = async (
  { user, targetType, targetId },
  options = {},
) => {
  if (!user || !targetType || !targetId) {
    throw new BadRequestError("user, targetType and targetId are required.");
  }

  return findReaction(
    { user, targetType, targetId },
    { ...options, lean: true },
  );
};

export const getReactionCount = async (
  { targetType, targetId, reactionType = "like" },
  options = {},
) => {
  if (!targetType || !targetId) {
    throw new BadRequestError("targetType and targetId are required.");
  }

  return countReactionsForTarget(
    { targetType, targetId, reactionType },
    options,
  );
};
