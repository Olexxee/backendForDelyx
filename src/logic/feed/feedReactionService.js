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
import {
  findFeedPostById,
  incrementPostReactionsCount,
} from "../../models/feedPostDb.js";
import {
  findFeedCommentById,
  incrementCommentReactionsCount,
} from "../../models/feedCommentDb.js";

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

const incrementTargetReactionCount = async (
  { targetType, targetId, value },
  options = {},
) => {
  if (targetType === "post") {
    await incrementPostReactionsCount(targetId, value, options);
    return;
  }

  if (targetType === "comment") {
    await incrementCommentReactionsCount(targetId, value, options);
    return;
  }

  throw new BadRequestError("Invalid target type.");
};

export const reactToTarget = async (payload, options = {}) => {
  const validated = validator.validate(reactToTargetSchema, payload);

  await ensureTargetExists(validated, options);

  const existingReaction = await findReaction(
    {
      user: validated.user,
      targetType: validated.targetType,
      targetId: validated.targetId,
    },
    options,
  );

  if (existingReaction) {
    if (existingReaction.reactionType === validated.reactionType) {
      return existingReaction;
    }

    return upsertReaction(validated, options);
  }

  const reaction = await upsertReaction(validated, options);

  await incrementTargetReactionCount(
    {
      targetType: validated.targetType,
      targetId: validated.targetId,
      value: 1,
    },
    options,
  );

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

  await incrementTargetReactionCount(
    {
      targetType: validated.targetType,
      targetId: validated.targetId,
      value: -1,
    },
    options,
  );

  return existingReaction;
};

export const reactToPost = async ({ user, postId }, options = {}) => {
  return reactToTarget(
    {
      user,
      targetType: "post",
      targetId: postId,
      reactionType: "like",
    },
    options,
  );
};

export const unreactToPost = async ({ user, postId }, options = {}) => {
  return unreactToTarget(
    {
      user,
      targetType: "post",
      targetId: postId,
    },
    options,
  );
};

export const reactToComment = async ({ user, commentId }, options = {}) => {
  return reactToTarget(
    {
      user,
      targetType: "comment",
      targetId: commentId,
      reactionType: "like",
    },
    options,
  );
};

export const unreactToComment = async ({ user, commentId }, options = {}) => {
  return unreactToTarget(
    {
      user,
      targetType: "comment",
      targetId: commentId,
    },
    options,
  );
};

export const hasReaction = async (
  { user, targetType, targetId },
  options = {},
) => {
  if (!user || !targetType || !targetId) {
    throw new BadRequestError("user, targetType and targetId are required.");
  }

  return findReaction(
    {
      user,
      targetType,
      targetId,
    },
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
    {
      targetType,
      targetId,
      reactionType,
    },
    options,
  );
};
