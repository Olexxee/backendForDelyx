import {
  BadRequestError,
  ForbiddenError,
  NotFoundException,
} from "../../lib/classes/errorClasses.js";

const isSameId = (a, b) => String(a) === String(b);

export const assertCanModifyComment = async ({ userId, comment }) => {
  if (!userId) {
    throw new BadRequestError("userId is required.");
  }

  if (!comment) {
    throw new NotFoundException("Comment not found.");
  }

  if (comment.status === "deleted") {
    throw new NotFoundException("Comment not found.");
  }

  if (!isSameId(comment.author, userId)) {
    throw new ForbiddenError("You are not allowed to modify this comment.");
  }

  return true;
};
