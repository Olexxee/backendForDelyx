import express from "express";
import {authMiddleware} from "../middlewares/authenticationMdw.js";
import { handleMediaUpload } from "../middlewares/uploadMiddleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middlewares/validatorMiddleware.js";
import { normalizeMultipartFeedPostBody } from "../middlewares/normalizeMultipartFeedPostBody.js";

import {
  createFeedPostSchema,
  updateFeedPostSchema,
  listFeedPostsSchema,
} from "../logic/feed/validation/feedPostValidation.js";
import {
  createFeedCommentSchema,
  updateFeedCommentSchema,
  listFeedCommentsSchema,
} from "../logic/feed/validation/feedCommentValidation.js";
import {
  authorIdParamSchema,
  commentIdParamSchema,
  contextPostParamsSchema,
  postIdParamSchema,
} from "../logic/feed/validation/feedParamsValidation.js";

import {
  createFeedPost,
  deleteFeedPost,
  getFeedPostById,
  getFeedPosts,
  getPostsByAuthor,
  getPostsByContext,
  updateFeedPost,
  hideFeedPost,
  unhideFeedPost,
  flagFeedPost,
  unflagFeedPost,
} from "../logic/feed/feedPostController.js";
import {
  createFeedComment,
  deleteFeedComment,
  getCommentsForPost,
  getRepliesForComment,
  updateFeedComment,
} from "../logic/feed/feedCommentController.js";
import {
  reactToComment,
  reactToPost,
  unreactToComment,
  unreactToPost,
} from "../logic/feed/feedReactionController.js";

const feedRouter = express.Router();

// ============ POSTS ============

feedRouter.post(
  "/posts",
  authMiddleware,
  handleMediaUpload("feed-post"),
  normalizeMultipartFeedPostBody,
  validateBody(createFeedPostSchema),
  createFeedPost,
);

feedRouter.patch(
  "/posts/:postId",
  authMiddleware,
  validateParams(postIdParamSchema),
  handleMediaUpload("feed-post"),
  normalizeMultipartFeedPostBody,
  validateBody(updateFeedPostSchema),
  updateFeedPost,
);

feedRouter.get("/posts", validateQuery(listFeedPostsSchema), getFeedPosts);

feedRouter.get(
  "/posts/:postId",
  authMiddleware,
  validateParams(postIdParamSchema),
  getFeedPostById,
);

feedRouter.delete(
  "/posts/:postId",
  authMiddleware,
  validateParams(postIdParamSchema),
  deleteFeedPost,
);

// Post moderation endpoints
feedRouter.patch(
  "/posts/:postId/hide",
  authMiddleware,
  validateParams(postIdParamSchema),
  hideFeedPost,
);

feedRouter.patch(
  "/posts/:postId/unhide",
  authMiddleware,
  validateParams(postIdParamSchema),
  unhideFeedPost,
);

feedRouter.patch(
  "/posts/:postId/flag",
  authMiddleware,
  validateParams(postIdParamSchema),
  flagFeedPost,
);

feedRouter.patch(
  "/posts/:postId/unflag",
  authMiddleware,
  validateParams(postIdParamSchema),
  unflagFeedPost,
);

// ============ CONTEXT & AUTHOR ============

feedRouter.get(
  "/contexts/:contextType/:contextId/posts",
  authMiddleware, // ✅ Added - required for private context access
  validateParams(contextPostParamsSchema),
  validateQuery(listFeedPostsSchema),
  getPostsByContext,
);

feedRouter.get(
  "/authors/:authorId/posts",
  authMiddleware, // ✅ Added - author posts may be private
  validateParams(authorIdParamSchema),
  validateQuery(listFeedPostsSchema),
  getPostsByAuthor,
);

// ============ COMMENTS ============

feedRouter.post(
  "/comments",
  authMiddleware,
  validateBody(createFeedCommentSchema),
  createFeedComment,
);

feedRouter.get(
  "/posts/:postId/comments",
  authMiddleware,
  validateParams(postIdParamSchema),
  validateQuery(listFeedCommentsSchema),
  getCommentsForPost,
);

feedRouter.get(
  "/comments/:commentId/replies",
  authMiddleware,
  validateParams(commentIdParamSchema),
  validateQuery(listFeedCommentsSchema),
  getRepliesForComment,
);

feedRouter.patch(
  "/comments/:commentId",
  authMiddleware,
  validateParams(commentIdParamSchema),
  validateBody(updateFeedCommentSchema),
  updateFeedComment,
);

feedRouter.delete(
  "/comments/:commentId",
  authMiddleware,
  validateParams(commentIdParamSchema),
  deleteFeedComment,
);

// ============ REACTIONS ============

feedRouter.post(
  "/posts/:postId/reactions",
  authMiddleware,
  validateParams(postIdParamSchema),
  reactToPost,
);

feedRouter.delete(
  "/posts/:postId/reactions",
  authMiddleware,
  validateParams(postIdParamSchema),
  unreactToPost,
);

feedRouter.post(
  "/comments/:commentId/reactions",
  authMiddleware,
  validateParams(commentIdParamSchema),
  reactToComment,
);

feedRouter.delete(
  "/comments/:commentId/reactions",
  authMiddleware,
  validateParams(commentIdParamSchema),
  unreactToComment,
);

export default feedRouter;
