import mongoose from "mongoose";
import * as favoriteCrud from "../../models/favoriteSchemaService.js";
import { hydrateFavorite } from "./hydrateFavorite.js";

/**
 * Toggle a favorite on/off for a user
 */
export const toggleFavoriteService = async (userId, postId, postType) => {
  // Ensure proper ObjectId conversion
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const existing = await favoriteCrud.findOne({
    userId: userObjectId,
    postId,
    postType,
  });

  if (existing) {
    await favoriteCrud.deleteOne({ _id: existing._id });
    return { postId, postType, favorited: false };
  }

  await favoriteCrud.create({ userId: userObjectId, postId, postType });
  return { postId, postType, favorited: true };
};

/**
 * Get all favorites for a user filtered by postType
 */
export const getUserFavoritesByTypeService = async (userId, postType) => {
  // Normalize postType to match database
  const typeMap = {
    events: "event",
    event: "event",
    posts: "post",
    post: "post",
    asks: "ask",
    ask: "ask",
    marts: "mart",
    mart: "mart",
  };
  postType = typeMap[postType] || postType;

  const userObjectId = new mongoose.Types.ObjectId(userId);

  const favorites = await favoriteCrud.findByUser(userObjectId, postType);

  // Hydrate each favorite and remove invalid ones
  const enriched = await Promise.all(
    favorites.map((fav) => hydrateFavorite(fav))
  );

  return enriched.filter(Boolean);
};

/**
 * Get all favorites for a user across all types
 */
// export const getAllUserFavoritesService = async (userId) => {
//   const userObjectId = new mongoose.Types.ObjectId(userId);

//   // Fetch raw favorites without hydration
//   const favorites = await favoriteCrud.findAllByUser(userObjectId);
//   console.log("Raw favorites from DB:", favorites);

//   // Hydrate each favorite
//   const enriched = await Promise.all(
//     favorites.map((fav) => hydrateFavorite(fav))
//   );

//   return enriched.filter(Boolean);
// };

export const getAllUserFavoritesService = async (userId) => {
  const favorites = await favoriteCrud.findAllByUser(userId);

  const enriched = await Promise.all(
    favorites.map((fav) => hydrateFavorite(fav))
  );

  return enriched.filter(Boolean);
};

