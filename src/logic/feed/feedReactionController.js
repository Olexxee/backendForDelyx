import { asyncWrapper } from "../../lib/utils.js";
import * as feedReactionService from "./feedReactionService.js";
import * as feedPostService from "./feedPostService.js";
import * as feedPostAccessService from "./feedPostAccessService.js";
import * as feedCommentService from "./feedCommentService.js";

export const reactToPost = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;
  const { postId } = req.params;

  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanReactToPost({
    userId,
    post,
  });

  const reaction = await feedReactionService.reactToPost({
    user: userId,
    postId,
  });

  return res.status(200).json({
    success: true,
    message: "Reaction added successfully.",
    data: reaction,
  });
});

export const unreactToPost = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;
  const { postId } = req.params;

  // Fix #2: Guard access before allowing unreact, mirroring reactToPost.
  const post = await feedPostService.getPostById(postId);

  await feedPostAccessService.assertCanReactToPost({
    userId,
    post,
  });

  const reaction = await feedReactionService.unreactToPost({
    user: userId,
    postId,
  });

  return res.status(200).json({
    success: true,
    message: "Reaction removed successfully.",
    data: reaction,
  });
});

export const reactToComment = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;
  const { commentId } = req.params;

  const comment = await feedCommentService.getCommentById(commentId);
  const post = await feedPostService.getPostById(comment.post);

  await feedPostAccessService.assertCanReactToPost({
    userId,
    post,
  });

  const reaction = await feedReactionService.reactToComment({
    user: userId,
    commentId,
  });

  return res.status(200).json({
    success: true,
    message: "Reaction added successfully.",
    data: reaction,
  });
});

export const unreactToComment = asyncWrapper(async (req, res) => {
  const userId = req.user?._id ?? req.user?.id;
  const { commentId } = req.params;

  // Fix #2: Guard access before allowing unreact, mirroring reactToComment.
  const comment = await feedCommentService.getCommentById(commentId);
  const post = await feedPostService.getPostById(comment.post);

  await feedPostAccessService.assertCanReactToPost({
    userId,
    post,
  });

  const reaction = await feedReactionService.unreactToComment({
    user: userId,
    commentId,
  });

  return res.status(200).json({
    success: true,
    message: "Reaction removed successfully.",
    data: reaction,
  });
});
