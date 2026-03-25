import joi from "joi";

export const registerSchema = joi.object({
  username: joi.string().min(3).max(30).required(),
  email: joi.string().email().required(),
  password: joi.string().min(8).required(),
});

const loginSchema = joi.object({
  email: joi.string().email().required(),
  password: joi.string().required(),
});

const verificationSchema = joi.object({
  email: joi.string().email().required(),
  verificationCode: joi.string().min(4).required(),
});

const changePasswordSchema = joi.object({
  email: joi.string().email().required(),
  oldPassword: joi.string().required(),
  newPassword: joi.string().required(),
});

const forgotPasswordSchema = joi.object({
  email: joi.string().email().required(),
});

const resetPasswordSchema = joi.object({
  email: joi.string().email().required(),
  code: joi.string().required(),
  newPassword: joi.string().required(),
  confirmPassword: joi
    .string()
    .valid(joi.ref("newPassword"))
    .required()
    .messages({
      "any.only": "Passwords do not match",
    }),
});

const updateUserProfileSchema = joi.object({
  name: joi.string(),
  bio: joi.string(),
});

export {
  loginSchema,
  updateUserProfileSchema,
  verificationSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};
