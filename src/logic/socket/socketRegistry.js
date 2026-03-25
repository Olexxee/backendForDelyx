import { redisClient } from "./redisClient.js";

const SOCKET_TTL = 86400; // 24 hours

const userSocketsKey = (userId) => `delyx:user:${userId}:sockets`;
const onlineUsersKey = "delyx:online:users";

/**
 * Register a socket for a user
 */
export const registerSocket = async (userId, socketId) => {
  const key = userSocketsKey(userId);

  await redisClient.sAdd(key, socketId);
  await redisClient.expire(key, SOCKET_TTL);
  await redisClient.sAdd(onlineUsersKey, userId);
};

/**
 * Unregister a socket for a user
 */
export const unregisterSocket = async (userId, socketId) => {
  const key = userSocketsKey(userId);

  await redisClient.sRem(key, socketId);

  const remaining = await redisClient.sCard(key);

  if (remaining === 0) {
    await redisClient.del(key);
    await redisClient.sRem(onlineUsersKey, userId);
  }
};

/**
 * Get all active socket IDs for a user
 */
export const getSocketsByUserId = async (userId) => {
  const key = userSocketsKey(userId);
  return await redisClient.sMembers(key);
};

/**
 * Check if user is online
 */
export const isUserOnline = async (userId) => {
  return await redisClient.sIsMember(onlineUsersKey, userId);
};
