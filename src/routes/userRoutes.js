import { Router } from "express";
import { updateUserProfile } from "../auth/authController.js";
import upload from "../lib/multerConfig.js";
import {authMiddleware} from "../middlewares/authenticationMdw.js";
import verifiedOnly from "../middlewares/verifiedOnly.js";

const router = Router();

router.put(
  "/updateprofile",
  authMiddleware,
  verifiedOnly,
  upload.single("profilePicture"),
  updateUserProfile
);

const userRoute = router;

export default userRoute;
