import { validationException } from "../lib/classes/errorClasses.js";

export default function errorMiddleware(err, req, res, next) {
  if (err instanceof ValiationException) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors,
    });
  }

  const code = err.statusCode || 500;
  const message = err.message || "Internal server error";

  return res.status(code).json({
    success: false,
    message,
    trace: err.stack,
  });
}
