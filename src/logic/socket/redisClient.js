// src/logic/socket/redisClient.js
import { createClient } from "redis";
import configService from "../../lib/classes/configClass.js";

// =============================
// Cloud Redis Configuration
// =============================
const host = configService.getOrThrow("REDIS_HOST");
const port = configService.getOrThrow("REDIS_PORT");
const rawPassword = configService.getOrThrow("REDIS_PASSWORD");
const username = configService.getOrThrow("REDIS_USERNAME");

// Always encode password in case it has special characters
const password = encodeURIComponent(rawPassword);

const redisUrl = `redis://${username}:${password}@${host}:${port}`;

// =============================
// Redis Clients
// =============================
export const redisClient = createClient({ url: redisUrl }); // General commands
export const pubClient = createClient({ url: redisUrl }); // Publisher for Socket.IO
export const subClient = pubClient.duplicate(); // Subscriber for Socket.IO

// =============================
// Error Handlers
// =============================
redisClient.on("error", (err) => console.error("❌ Redis Client Error:", err));
pubClient.on("error", (err) => console.error("❌ Redis Pub Error:", err));
subClient.on("error", (err) => console.error("❌ Redis Sub Error:", err));

// =============================
// Connect All Redis Clients
// =============================
export const connectRedis = async () => {
  const clients = [
    { client: redisClient, label: "registry" },
    { client: pubClient, label: "pub" },
    { client: subClient, label: "sub" },
  ];

  await Promise.all(
    clients.map(async ({ client, label }) => {
      if (!client.isOpen) {
        await client.connect();
        console.info(`✅ Redis connected (${label})`);
      }
    }),
  );
};
