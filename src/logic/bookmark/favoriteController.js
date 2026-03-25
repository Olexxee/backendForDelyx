// src/logic/bookmark/favoriteController.js

import { asyncWrapper } from "../../lib/utils.js";
import * as favoriteService from "./favoriteService.js";

/**
 * Toggle a favorite for a user (add/remove)
 */
export const toggleFavoriteController = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { postId, postType } = req.body;

  const data = await favoriteService.toggleFavoriteService(
    userId,
    postId,
    postType
  );

  return res.status(200).json({
    success: true,
    message: data.favorited ? "Added to favorites" : "Removed from favorites",
    data,
  });
});

/**
 * Get all favorites for a specific post type
 * @route GET /favorites/:postType
 */
export const getFavoritesByTypeController = asyncWrapper(async (req, res) => {
  const userId = req.user.id;
  const { postType } = req.params;

  const data = await favoriteService.getUserFavoritesByTypeService(
    userId,
    postType
  );

  return res.status(200).json({
    success: true,
    count: data.length,
    data,
  });
});

/**
 * Get all favorites for the logged-in user (all types combined)
 * @route GET /favorites/get-bookmarked
 */
export const getAllFavoritesController = asyncWrapper(async (req, res) => {
  const userId = req.user.id;

  const data = await favoriteService.getAllUserFavoritesService(userId);
  console.log(data);
  return res.status(200).json({
    success: true,
    count: data.length,
    data,
  });
});
