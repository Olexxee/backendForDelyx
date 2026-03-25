import logger from "../lib/logger.js";
import jwtService from "../lib/classes/jwtClass.js";
import { UnauthorizedException } from "../lib/classes/errorClasses.js";

/**
 * Extract token from header or cookies
 */
const extractToken = (req) => {
  const authHeader = req.headers.authorization;

  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  if (req.cookies?.token) {
    return req.cookies.token;
  }

  return null;
};

/**
 * Required authentication
 */
export const authMiddleware = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedException("No authentication token provided");
    }

    const decoded = jwtService.verifyAuthenticationToken(token);

    req.user = {
      id: decoded.id,
      _id: decoded.id,
      email: decoded.email,
      profileId: decoded.profileId || null,
      iat: decoded.iat,
      exp: decoded.exp,
    };

    next();
  } catch (err) {
    logger.error("Authentication failed:", err.message);
    next(new UnauthorizedException(err.message || "Unauthorized"));
  }
};

/**
 * Optional authentication
 * Attaches user if token exists but never blocks request
 */
export const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) return next();

    const decoded = jwtService.verifyAuthenticationToken(token);

    req.user = {
      id: decoded.id,
      _id: decoded.id,
      email: decoded.email,
      profileId: decoded.profileId || null,
      iat: decoded.iat,
      exp: decoded.exp,
    };

    logger.info("Optional auth successful:", req.user.email || req.user.id);

    next();
  } catch (err) {
    logger.warn("Optional auth failed, continuing as guest:", err.message);
    next();
  }
};

/**
 * Require authenticated user
 */
export const requireVerifiedUser = (req, res, next) => {
  if (!req.user) {
    throw new UnauthorizedException("Authentication required");
  }

  next();
};
