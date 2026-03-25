import { Router } from "express";
import  authMiddleware  from "../middlewares/authenticationMdw.js";
import { handleMediaUpload } from "../middlewares/uploadMiddleware.js";
import * as timelineController from "../logic/timeline/timelineController.js";
import { validateBody } from "../middlewares/validatorMiddleware.js";
import { createPostSchema, feedQerySchema } from "../logic/timeline/timelineRequest.js";

const timelineRouter = Router();

/**
 * ======================
 * PUBLIC ROUTES
 * ======================
 */

// feed (paginated)
timelineRouter.get("/feed", timelineController.getFeed);

// list comments for a post
timelineRouter.get("/posts/:postId/comments", timelineController.listComments);

/**
 * ======================
 * AUTHENTICATED ROUTES
 * ======================
 */

// create a post (text + images)
timelineRouter.post(
  "/posts",
  authMiddleware,
  handleMediaUpload("timeline"),
  validateBody(createPostSchema),
  timelineController.createPost
);

// delete a post
timelineRouter.delete(
  "/posts/:postId",
  authMiddleware,
  timelineController.deletePost
);

// add comment
timelineRouter.post(
  "/posts/:postId/comments",
  authMiddleware,
  handleMediaUpload("timeline"),
  timelineController.addComment
);

// delete comment
timelineRouter.delete(
  "/comments/:commentId",
  authMiddleware,
  timelineController.deleteComment
);

// reactions
timelineRouter.post(
  "/posts/:postId/like",
  authMiddleware,
  timelineController.likePost
);

timelineRouter.post(
  "/posts/:postId/unlike",
  authMiddleware,
  timelineController.unlikePost
);

export default timelineRouter;
