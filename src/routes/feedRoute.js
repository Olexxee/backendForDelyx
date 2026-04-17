import express from "express";
import authMiddleware from "../middleware/authMiddleware.js";
import {
  validateBody,
  validateParams,
  validateQuery,
} from "../middleware/validationMiddleware.js";
import {
  createFeedPostSchema,
  updateFeedPostSchema,
} from "../logic/feed/validation/feedPostValidation.js";
import {
  listCommentsQuerySchema,
  listPostsQuerySchema,
} from "../logic/feed/validation/feedQueryValidation.js";
import {
  createFeedCommentSchema,
  updateFeedCommentSchema,
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
} from "../logic/feed/controllers/feedPostController.js";
import {
  createFeedComment,
  deleteFeedComment,
  getCommentsForPost,
  getRepliesForComment,
  updateFeedComment,
} from "../logic/feed/controllers/feedCommentController.js";
import {
  reactToComment,
  reactToPost,
  unreactToComment,
  unreactToPost,
} from "../logic/feed/controllers/feedReactionController.js";

const feedRouter = express.Router();

// Posts
feedRouter.post(
  "/posts",
  authMiddleware,
  validateBody(createFeedPostSchema),
  createFeedPost,
);

feedRouter.get("/posts", validateQuery(listPostsQuerySchema), getFeedPosts);

feedRouter.get(
  "/posts/:postId",
  validateParams(postIdParamSchema),
  getFeedPostById,
);

feedRouter.patch(
  "/posts/:postId",
  authMiddleware,
  validateParams(postIdParamSchema),
  validateBody(updateFeedPostSchema),
  updateFeedPost,
);

feedRouter.delete(
  "/posts/:postId",
  authMiddleware,
  validateParams(postIdParamSchema),
  deleteFeedPost,
);

feedRouter.get(
  "/contexts/:contextType/:contextId/posts",
  validateParams(contextPostParamsSchema),
  validateQuery(listPostsQuerySchema),
  getPostsByContext,
);

feedRouter.get(
  "/authors/:authorId/posts",
  validateParams(authorIdParamSchema),
  validateQuery(listPostsQuerySchema),
  getPostsByAuthor,
);

// Comments
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
  validateQuery(listCommentsQuerySchema),
  getCommentsForPost,
);

feedRouter.get(
  "/comments/:commentId/replies",
  authMiddleware,
  validateParams(commentIdParamSchema),
  validateQuery(listCommentsQuerySchema),
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

// Reactions
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
