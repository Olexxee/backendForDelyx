import Joi from "joi";
import moment from "moment";

export const createTournamentSchema = Joi.object({
  name: Joi.string().min(3).max(100).required(),

  description: Joi.string().max(500).allow("").optional(),

  maxParticipants: Joi.number().min(4).max(50).default(20),

  startDate: Joi.date().min("now").required(),

  endDate: Joi.date().greater(Joi.ref("startDate")).required(),

  registrationDeadline: Joi.date()
    .less(Joi.ref("startDate"))
    .min("now")
    .required()
    .messages({
      "date.less": "Registration deadline must be before the start date",
    }),

  settings: Joi.object({
    pointsForWin: Joi.number().min(0).max(10).default(3),
    pointsForDraw: Joi.number().min(0).max(10).default(1),
    pointsForLoss: Joi.number().min(0).max(10).default(0),
    rounds: Joi.string().valid("single", "double").default("single"),
  }).optional(),
});
export const updateTournamentSchema = Joi.object({
  name: Joi.string().min(3).max(100).optional(),
  description: Joi.string().max(500).allow("").optional(),
  maxParticipants: Joi.number().min(4).max(50).optional(),
  registrationDeadline: Joi.date().min("now").optional(),
  settings: Joi.object({
    pointsForWin: Joi.number().min(0).max(10).optional(),
    pointsForDraw: Joi.number().min(0).max(10).optional(),
    pointsForLoss: Joi.number().min(0).max(10).optional(),
    rounds: Joi.string().valid("single", "double").optional(),
  }).optional(),
});
