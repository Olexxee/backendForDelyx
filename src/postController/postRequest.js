import joi from "joi";

export const postSchema = joi.object({
  userId: joi.string().required(),
  caption: joi.string().max(500).optional(),
  mediaUrl: joi.string(),
  mediaType: joi.string().valid("image", "video", "audio").required(),
});
