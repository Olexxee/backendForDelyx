import logger from "../../lib/logger.js";
import * as timelineService from "./timelineService.js";
import { asyncWrapper } from "../../lib/utils.js";
import { processUploadedMedia } from "../../middlewares/processUploadedImages.js";

// -------------------------
// Create a new timeline post
// -------------------------
export const createPost = asyncWrapper(async (req, res) => {
  const uploadedMedia = await processUploadedMedia(
    req.files,
    "timeline",
    req.user,
    {
      resizeWidth: 1080,
      resizeHeight: 1080,
      minCount: 0,
    }
  );

  const payload = {
    ownerId: req.user.id,
    content: req.body.content || "",
    visibility: req.body.visibility || "public",
    tags: req.body.tags || [],
    media: uploadedMedia.map((m) => m._id),
  };

  res.status(201).json({
    success: true,
    data: {
      ...post.toObject(),
      media: mediaWithUrls, // replace IDs with full media info
    },
  });
});

// -------------------------
// Delete a timeline post
// -------------------------
export const deletePost = asyncWrapper(async (req, res) => {
  const result = await timelineService.deletePost(
    req.user,
    req.params.postId,
    !!req.user.isAdmin
  );

  res.status(200).json({ success: true, ...result });
});

// -------------------------
// Get feed (public or authenticated)
// -------------------------
export const getFeed = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 10, scope = "default" } = req.query;

  const feed = await timelineService.getFeed(req.user || null, {
    page,
    limit,
    scope,
  });

  res.status(200).json({
    success: true,
    page: Number(page),
    limit: Number(limit),
    ...feed,
  });
});

// -------------------------
// Add a comment to a post
// -------------------------
export const addComment = asyncWrapper(async (req, res) => {
  const { postId } = req.params;

  const uploadedMedia = await processUploadedMedia(
    req.files,
    "timeline",
    req.user,
    {
      resizeWidth: 1080,
      resizeHeight: 1080,
      minCount: 0,
    }
  );

  const mediaIds = uploadedMedia.map((m) => m._id);

  const comment = await timelineService.addComment(req.user, postId, {
    content: req.body.content || "",
    media: mediaIds,
    parentComment: req.body.parentComment || null,
  });

  res.status(201).json({ success: true, data: comment });
});

// -------------------------
// Delete a comment
// -------------------------
export const deleteComment = asyncWrapper(async (req, res) => {
  const result = await timelineService.deleteComment(
    req.user,
    req.params.commentId,
    !!req.user.isAdmin
  );

  res.status(200).json({ success: true, ...result });
});

// -------------------------
// Like / Unlike a post
// -------------------------
export const likePost = asyncWrapper(async (req, res) => {
  const result = await timelineService.likePost(req.user, req.params.postId);
  res.status(200).json({ success: true, ...result });
});

export const unlikePost = asyncWrapper(async (req, res) => {
  const result = await timelineService.unlikePost(req.user, req.params.postId);
  res.status(200).json({ success: true, ...result });
});

// -------------------------
// List comments on a post with pagination
// -------------------------
export const listComments = asyncWrapper(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;

  const comments = await timelineService.listComments(req.params.postId, {
    page: Number(page),
    limit: Number(limit),
  });

  res.status(200).json({ success: true, data: comments });
});
