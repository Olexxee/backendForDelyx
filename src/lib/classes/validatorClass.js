import { ValidationException } from "./errorClasses.js";

export class ValidatorClass {
  validate(schema, payload) {
    const { error, value } = schema.validate(payload, { abortEarly: false });

    if (error) {
      const detail = error.details[0]; // throw first error
      const message = detail.message;
      const path = detail.path.join(".");
      throw new ValidationException(message, path);
    }

    return value;
  }

  body(schema, req) {
    req.body = this.validate(schema, req.body);
  }

  query(schema, req) {
    req.query = this.validate(schema, req.query);
  }

  params(schema, req) {
    req.params = this.validate(schema, req.params);
  }
}

export const validator = new ValidatorClass();
