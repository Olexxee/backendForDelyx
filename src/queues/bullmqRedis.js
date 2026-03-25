import Redis from "ioredis";
import configService from "../lib/classes/configClass.js";

export const bullMQRedis = new Redis({
  host: configService.getOrThrow("REDIS_HOST"),
  port: Number(configService.getOrThrow("REDIS_PORT")),
  username: configService.getOrThrow("REDIS_USERNAME"),
  password: configService.getOrThrow("REDIS_PASSWORD"),
  maxRetriesPerRequest: null,
});
