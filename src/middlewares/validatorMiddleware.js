import logger from "../lib/logger.js";
import { validator } from "../lib/classes/validatorClass.js";
import { ValidationException } from "../lib/classes/errorClasses.js";

export const validateBody = (schema) => (req, res, next) => {
  try {
    validator.body(schema, req);
    next();
  } catch (err) {
    next(err);
  }
};

export const validateQuery = (schema) => (req, res, next) => {
  try {
    validator.query(schema, req);
    next();
  } catch (err) {
    next(
      err instanceof ValidationException
        ? err
        : new ValidationException(err.message),
    );
  }
};

export const validateParams = (schema) => (req, res, next) => {
  try {
    validator.params(schema, req);
    next();
  } catch (err) {
    next(
      err instanceof ValidationException
        ? err
        : new ValidationException(err.message),
    );
  }
};
