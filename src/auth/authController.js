import * as authService from "./authService.js";
import {
  ValidationException,
  BadRequestError,
} from "../lib/classes/errorClasses.js";
import { ValidatorClass } from "../lib/classes/validatorClass.js";
import path from "path";
import fs from "fs";
import {
  registerSchema,
  loginSchema,
  updateUserProfileSchema,
  verificationSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./authRequest.js";
import { asyncWrapper } from "../lib/utils.js";

const validator = new ValidatorClass();

/* ================= AUTH ================= */

export const signUp = asyncWrapper(async (req, res) => {
  const validated = validator.validate(registerSchema, req.body);
  const { token, user } = await authService.registerUser(validated);

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res.status(201).json({
    token,
    user,
  });
});

export const login = asyncWrapper(async (req, res) => {
  const validated = validator.validate(loginSchema, req.body);
  const { token, user } = await authService.authenticateUser(validated);

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
  });

  return res.status(200).json({
    token,
    user,
  });
});

/* ================= USER PROFILE ================= */

export const getUser = asyncWrapper(async (req, res) => {
  const user = await authService.getUserProfile(req.user.email);
  return res.status(200).json({ user });
});

export const updateUserProfile = asyncWrapper(async (req, res) => {
  const { error, value } = updateUserProfileSchema.validate(req.body);
  if (error) throw new BadRequestError(error.details[0].message);

  const profilePicture = req.file
    ? `/uploads/profile_pictures/${req.file.filename}`
    : undefined;

  const payload = {
    email: req.user.email,
    ...value,
    ...(profilePicture && { profilePicture }),
  };

  try {
    const user = await authService.updateUserProfile(payload);
    return res.status(200).json({ user });
  } catch (err) {
    // Delete uploaded file if update fails
    if (req.file) {
      fs.unlink(
        path.join("uploads", "profile_pictures", req.file.filename),
        () => {},
      );
    }
    throw err;
  }
});

/* ================= VERIFICATION ================= */

export const sendVerificationEmail = asyncWrapper(async (req, res) => {
  const result = await authService.sendVerificationEmail(req.body.email);
  return res.status(200).json(result);
});

export const verifyEmail = asyncWrapper(async (req, res) => {
  const { error } = verificationSchema.validate(req.body);
  if (error) throw new BadRequestError(error.details[0].message);

  const user = await authService.verifyUser(
    req.body.email,
    req.body.verificationCode,
  );

  return res.status(200).json({ user });
});

/* ================= LOGOUT ================= */

export const logout = asyncWrapper(async (req, res) => {
  res.clearCookie("token");
  return res.status(200).json({ success: true });
});

/* ================= PASSWORD MANAGEMENT ================= */

export const changePassword = asyncWrapper(async (req, res) => {
  const { error, value } = changePasswordSchema.validate(req.body);
  if (error) throw new BadRequestError(error.details[0].message);

  const userId = req.user._id;
  await authService.changePassword(userId, value);

  return res.status(200).json({ message: "Password changed successfully" });
});

export const forgotPassword = asyncWrapper(async (req, res) => {
  const { error, value } = forgotPasswordSchema.validate(req.body);
  if (error) throw new BadRequestError(error.details[0].message);

  await authService.forgotPassword(value.email);

  return res.status(200).json({
    message: "Password reset link sent to your email",
  });
});

export const resetPassword = asyncWrapper(async (req, res) => {
  const { error, value } = resetPasswordSchema.validate(req.body);
  if (error) throw new BadRequestError(error.details[0].message);

  await authService.resetPassword(value.token, value.newPassword, value.email);

  return res.status(200).json({
    message: "Password has been reset successfully",
  });
});

export const saveDeviceToken = async (req, res) => {
  const userId = req.user.id;
  const { deviceToken } = req.body;

  if (!deviceToken)
    return res.status(400).json({ message: "No device token provided" });

  try {
    const updatedUser = await authService.addDeviceToken(userId, deviceToken);
    res.json({
      message: "Device token saved",
      deviceTokens: updatedUser.deviceTokens,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to save device token" });
  }
};

export const removeDeviceToken = async (req, res) => {
  const userId = req.user.id;
  const { deviceToken } = req.body;

  if (!deviceToken)
    return res.status(400).json({ message: "No device token provided" });

  try {
    const updatedUser = await authService.removeDeviceToken(
      userId,
      deviceToken,
    );
    res.json({
      message: "Device token removed",
      deviceTokens: updatedUser.deviceTokens,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to remove device token" });
  }
};
