import jwt from "jsonwebtoken";
import configService from "./configClass.js";
import { convertHumanReadableTimeToMilliseconds } from "../utils.js";

class JwtService {
  generateAuthenticationToken(payload) {
    return jwt.sign(payload, configService.getOrThrow("JWT_SECRET"), {
      expiresIn: configService.getOrThrow("JWT_EXPIRE_IN"),
    });
  }

  verifyAuthenticationToken(token) {
    return jwt.verify(token, configService.getOrThrow("JWT_SECRET"));
  }
}

export default new JwtService();
