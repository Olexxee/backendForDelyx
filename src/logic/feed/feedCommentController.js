import { asyncWrapper } from "../../lib/utils.js";
import * as feedCommentService from "./feedCommentService.js";
import * as feedPostService from "./feedPostService.js";
import * as feedPostAccessService from "./feedPostAccessService.js";
import * as feedCommentAccessService from "./feedCommentAccessService.js";

export const createFeedComment = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;

  const post = await feedPostService.getPostById(req.body.post);

  await feedPostAccessService.assertCanCommentOnPost({
    userId,
    post,
  });

  const comment = await feedCommentService.createComment({
    ...req.body,
    author: userId,
  });

  return res.status(201).json({
    success: true,
    message: "Comment created successfully.",
    data: comment,
  });
});

export const getCommentsForPost = asyncWrapper(async (req, res) => {
  const { postId } = req.params;
  const { page = 1, limit = 20, status = "active" } = req.query;

  const userId = req.user?._id ?? req.user?.id;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanViewPost({
    userId,
    post,
  });

  const result = await feedCommentService.getCommentsForPost(
    {
      postId,
      page,
      limit,
      status,
    },
    {
      populate: [{ path: "author", select: "username profilePicture" }],
    },
  );

  return res.status(200).json({
    success: true,
    ...result,
  });
});

export const getRepliesForComment = asyncWrapper(async (req, res) => {
  const { commentId } = req.params;
  const { page = 1, limit = 20, status = "active" } = req.query;
  const userId = req.user?._id ?? req.user?.id;

  const parentComment = await feedCommentService.getCommentById(commentId);
  const post = await feedPostService.getPostById(parentComment.post);

  await feedPostAccessService.assertCanViewPost({
    userId,
    post,
  });

  const result = await feedCommentService.getRepliesForComment(
    {
      parentCommentId: commentId,
      page,
      limit,
      status,
    },
    {
      populate: [{ path: "author", select: "username profilePicture" }],
    },
  );

  return res.status(200).json({
    success: true,
    ...result,
  });
});

export const updateFeedComment = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;
  const { commentId } = req.params;

  const existingComment = await feedCommentService.getCommentById(commentId);

  await feedCommentAccessService.assertCanModifyComment({
    userId,
    comment: existingComment,
  });

  const updatedComment = await feedCommentService.updateComment(
    commentId,
    req.body,
  );

  return res.status(200).json({
    success: true,
    message: "Comment updated successfully.",
    data: updatedComment,
  });
});

export const deleteFeedComment = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;
  const { commentId } = req.params;

  const existingComment = await feedCommentService.getCommentById(commentId);

  await feedCommentAccessService.assertCanModifyComment({
    userId,
    comment: existingComment,
  });

  const deletedComment = await feedCommentService.softDeleteComment(commentId);

  return res.status(200).json({
    success: true,
    message: "Comment deleted successfully.",
    data: deletedComment,
  });
});
