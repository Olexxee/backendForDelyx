import Joi from "joi";
import { ValidatorClass } from "../../lib/classes/validatorClass.js";

export class FavoriteValidator extends ValidatorClass {
  constructor() {
    super();

    this.toggleFavoriteSchema = Joi.object({
      postId: Joi.string().required(),
      postType: Joi.string().valid("event", "buddy", "catalog", "ask").required(),
    });
  }
}
