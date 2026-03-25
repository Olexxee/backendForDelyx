import {
  NotFoundException,
  BadRequestError,
  ForbiddenError,
} from "../lib/classes/errorClasses.js";
import { asyncWrapper } from "../lib/utils.js";
import * as userService from "../user/userService.js";

const verifiedOnly = asyncWrapper(async (req, res, next) => {
  const email = req.user?.email;

  if (!email) {
    throw new NotFoundException("User email not found in request");
  }

  const user = await userService.findUserByEmail({ email });

  if (!user) {
    throw new NotFoundException("User not found");
  }

  if (!user.isVerified) {
    throw new ForbiddenError("Only verified users can perform this action");
  }

  next(); // ✅ User is verified, proceed to next middleware
});

export default verifiedOnly;
