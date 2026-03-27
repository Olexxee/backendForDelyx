import { createClient } from "redis";
import configService from "../lib/classes/configClass.js";

const client = createClient({
  socket: {
    host: configService.getOrThrow("REDIS_HOST"),
    port: Number(configService.getOrThrow("REDIS_PORT")),
    tls: true,                    // required for Redis Cloud
  },
  username: configService.getOrThrow("REDIS_USERNAME"),
  password: configService.getOrThrow("REDIS_PASSWORD"),
});

export default client;