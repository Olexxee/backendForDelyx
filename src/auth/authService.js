import * as userService from "../user/userService.js";
import {
  ConflictException,
  NotFoundException,
  ForbiddenError,
  BadRequestError,
  UnauthorizedException,
} from "../lib/classes/errorClasses.js";
import bcrypt from "bcrypt";
import jwtService from "../lib/classes/jwtClass.js";
import { serializeUser } from "../lib/serializeUser.js";
import crypto from "crypto";
import configService from "../lib/classes/configClass.js";
import { enqueueNotificationJob } from "../queues/notificationQueue.js";

/* ================= AUTHENTICATION ================= */

export const authenticateUser = async ({ email, password }) => {
  const user = await userService.findUserByEmailWithPassword({ email });
  if (!user) throw new UnauthorizedException("Invalid credentials");

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) throw new UnauthorizedException("Invalid credentials");

  const token = jwtService.generateAuthenticationToken({
    id: user._id,
    email: user.email,
    role: user.role,
  });

  return { token, user: serializeUser(user) };
};

export const registerUser = async (payload) => {
  const existingUser = await userService.findUserByEmail({
    email: payload.email,
  });
  if (existingUser) throw new ConflictException("User already exists");

  const newUser = await userService.createUser(payload);

  const token = jwtService.generateAuthenticationToken({
    id: newUser._id,
    email: newUser.email,
    role: newUser.role,
  });

  await enqueueNotificationJob("USER_REGISTERED", {
    userId: newUser._id.toString(),
  });

  return { token, user: serializeUser(newUser) };
};

/* ================= USER PROFILE ================= */

export const getUserProfile = async (email) => {
  const user = await userService.findUserByEmail({ email });
  if (!user) throw new NotFoundException("User not found");
  return serializeUser(user);
};

export const updateUserProfile = async ({ email, ...updates }) => {
  const user = await userService.findUserByEmail({ email });
  if (!user) throw new NotFoundException("User not found");
  if (!user.verified) {
    throw new ForbiddenError("Only verified users can update profile");
  }

  const updatedUser = await userService.updateUserByEmail(email, updates);
  return serializeUser(updatedUser);
};

/* ================= EMAIL VERIFICATION ================= */

export const sendVerificationEmail = async (email) => {
  const user = await userService.findUserByEmail({ email });
  if (!user) throw new NotFoundException("User not found");
  if (user.verified) throw new BadRequestError("User already verified");

  const verificationCode = Math.floor(
    100000 + Math.random() * 900000,
  ).toString();

  user.verificationCode = await bcrypt.hash(verificationCode, 10);
  user.verificationCodeExpiresAt = Date.now() + 10 * 60 * 1000;
  await user.save();

  await enqueueNotificationJob("VERIFICATION_SENT", {
    userId: user._id.toString(),
    verificationCode,
  });

  return { expiresIn: 10 };
};

export const verifyUser = async (email, code) => {
  const user = await userService.findUserWithVerificationFields({ email });
  if (!user) throw new NotFoundException("User not found");

  if (!user.verificationCode || !user.verificationCodeExpiresAt) {
    throw new BadRequestError("No verification code found");
  }

  if (user.verificationCodeExpiresAt < Date.now()) {
    throw new BadRequestError("Verification code expired");
  }

  const isValid = await bcrypt.compare(code, user.verificationCode);
  if (!isValid) throw new BadRequestError("Invalid verification code");

  user.verified = true;
  user.verificationCode = undefined;
  user.verificationCodeExpiresAt = undefined;
  await user.save();

  return serializeUser(user);
};

/* ================= PASSWORD MANAGEMENT ================= */

export const changePassword = async (
  userId,
  { currentPassword, newPassword },
) => {
  const user = await userService.findUserByIdWithPassword(userId);
  if (!user) throw new NotFoundException("User not found");

  const isValid = await bcrypt.compare(currentPassword, user.password);
  if (!isValid) throw new BadRequestError("Current password is incorrect");

  user.password = newPassword;
  await user.save();

  await enqueueNotificationJob("PASSWORD_CHANGED", {
    userId: user._id.toString(),
  });

  return true;
};

export const forgotPassword = async (email) => {
  const user = await userService.findUserByEmail({ email });
  if (!user) throw new NotFoundException("User not found");

  const token = crypto.randomBytes(32).toString("hex");
  const tokenExpires = Date.now() + 60 * 60 * 1000;

  user.resetPasswordToken = await bcrypt.hash(token, 10);
  user.resetPasswordExpires = tokenExpires;
  await user.save();

  const resetLink = `${configService.getOrThrow("FRONTEND_URL")}/reset-password?token=${token}&email=${user.email}`;

  await enqueueNotificationJob("PASSWORD_RESET_REQUESTED", {
    userId: user._id.toString(),
    resetLink,
  });

  return { message: "Password reset link sent to your email" };
};

export const resetPassword = async (token, newPassword, email) => {
  const user = await userService.findUserByEmailWithResetFields({ email });
  if (!user) throw new NotFoundException("User not found");

  if (!user.resetPasswordToken || !user.resetPasswordExpires) {
    throw new BadRequestError("No reset request found");
  }

  if (user.resetPasswordExpires < Date.now()) {
    throw new BadRequestError("Reset token expired");
  }

  const isValid = await bcrypt.compare(token, user.resetPasswordToken);
  if (!isValid) throw new BadRequestError("Invalid reset token");

  user.password = newPassword;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  await user.save();

  await enqueueNotificationJob("PASSWORD_RESET_SUCCESS", {
    userId: user._id.toString(),
  });

  return true;
};

export const addDeviceToken = async (userId, deviceToken) => {
  const user = await userService.findAndUpdateUserById(userId, {
    $addToSet: { deviceTokens: deviceToken },
  });

  if (!user) throw new NotFoundException("User not found");

  return serializeUser(user);
};

export const removeDeviceToken = async (userId, deviceToken) => {
  const user = await userService.findAndUpdateUserById(userId, {
    $pull: { deviceTokens: deviceToken },
  });

  if (!user) throw new NotFoundException("User not found");

  return serializeUser(user);
};