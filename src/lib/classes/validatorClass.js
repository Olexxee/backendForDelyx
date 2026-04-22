import Joi from "joi";
import { ValidationException } from "./errorClasses.js";

class ValidatorClass {
  validate(schema, value) {
    const { error, value: validatedValue } = schema.validate(value, {
      abortEarly: false,
      stripUnknown: true,
    });

    if (error) {
      throw new ValidationException(
        error.details.map((item) => item.message).join(", "),
      );
    }

    return validatedValue;
  }

  body(schema, req) {
    const validatedBody = this.validate(schema, req.body ?? {});
    req.body = validatedBody;
    return req.body;
  }

  query(schema, req) {
    const validatedQuery = this.validate(schema, req.query ?? {});
    Object.assign(req.query, validatedQuery);
    return req.query;
  }

  params(schema, req) {
    const validatedParams = this.validate(schema, req.params ?? {});
    Object.assign(req.params, validatedParams);
    return req.params;
  }
}

export const validator = new ValidatorClass();
 
