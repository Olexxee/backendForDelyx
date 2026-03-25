export class BadRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = "BadRequestError";
    this.statusCode = 400;
  }
}

export class UnauthorizedException extends Error {
  constructor(message) {
    super(message);
    this.name = "UnauthorizedError";
    this.statusCode = 401;
  }
}

export class ForbiddenError extends Error {
  constructor(message) {
    super(message);
    this.name = "ForbiddenError";
    this.statusCode = 403;
  }
}

export class ConflictException extends Error {
  constructor(message) {
    super(message);
    this.name = "ConflictException";
    this.statusCode = 409;
  }
}

export class NotFoundException extends Error {
  constructor(message) {
    super(message);
    this.name = "notFoundError";
    this.statusCode = 404;
  }
}

export class TooManyRequestsError extends Error {
  constructor(message) {
    super(message);
    this.name = "TooManyRequestsError";
    this.statusCode = 429;
  }
}

export class InternalServerError extends Error {
  constructor(message) {
    super(message);
    this.name = "InternalServerError";
    this.statusCode = 500;
  }
}

export class ValidationException extends Error {
  constructor(message) {
    super(message);
    this.name = "ValidationError";
    this.statusCode = 422;
  }
}

export class CustomError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}
