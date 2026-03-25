import { Router } from "express";
import upload from "../lib/multerConfig.js";
import {authMiddleware} from "../middlewares/authenticationMdw.js";
import {
  createPost,
  getPostsByUser,
  deletePost,
} from "../postController/postController.js";

const router = Router();

router.post("/post", authMiddleware, upload.single("mediaUrl"), createPost);
router.get("/getposts", getPostsByUser);
router.delete("/deletepost", authMiddleware, deletePost);

export const postRoute = router;
