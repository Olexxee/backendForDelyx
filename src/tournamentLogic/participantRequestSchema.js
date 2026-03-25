import Joi from "joi";

export const registerParticipantSchema = Joi.object({
  tournamentId: Joi.string().required(),
});

export const bulkRegisterSchema = Joi.object({
  userIds: Joi.array().items(Joi.string()).min(1).max(10).required(),
});

export const withdrawParticipantSchema = Joi.object({
  reason: Joi.string().max(200).optional(),
});

export const updateParticipantSchema = Joi.object({
  userId: Joi.string().required(),
    status: Joi.string().valid("registered", "withdrawn").required(),
    score: Joi.number().min(0).max(100).optional(),
    feedback: Joi.string().max(500).optional(),
}); 