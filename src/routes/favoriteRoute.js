import { Router } from "express";
import { validateBody } from "../../middlewares/validatorMiddleware.js";
import { FavoriteValidator } from "../../logic/bookmark/favoriteValidator.js";
import * as favoriteController from "../../logic/bookmark/favoriteController.js";
import { authMiddleware } from "../../middlewares/authenticationMdw.js";

const bookmarkRouter = Router();
const validator = new FavoriteValidator();

// Toggle favorite
bookmarkRouter.post(
  "/toggle",
  authMiddleware,
  validateBody(validator.toggleFavoriteSchema),
  favoriteController.toggleFavoriteController
);

// Get all favorites for logged-in user
bookmarkRouter.get(
  "/all",
  authMiddleware,
  favoriteController.getAllFavoritesController
);

// Get all favorites by type
bookmarkRouter.get(
  "/:postType",
  authMiddleware,
  favoriteController.getFavoritesByTypeController
);



export default bookmarkRouter;
