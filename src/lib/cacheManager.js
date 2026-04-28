import memoryCache from "./cache.js";
import { redisClient } from "../logic/socket/redisClient.js";

const isRedisAvailable = () => redisClient?.isOpen;

class CacheManager {
  async get(key) {
    if (isRedisAvailable()) {
      const data = await redisClient.get(key);
      return data ? JSON.parse(data) : null;
    }

    return memoryCache.get(key);
  }

  async set(key, value, ttl = 300) {
    if (isRedisAvailable()) {
      await redisClient.setEx(key, ttl, JSON.stringify(value));
      return;
    }

    memoryCache.set(key, value, ttl);
  }

  async delete(key) {
    if (isRedisAvailable()) {
      await redisClient.del(key);
      return;
    }

    memoryCache.delete(key);
  }

  async deleteByPattern(pattern) {
    if (!redisClient.isOpen) return;

    const keys = await redisClient.keys(pattern);
    if (keys.length) {
      await redisClient.del(keys);
    }
  }

  async getWithVersion(key, version) {
    const versionedKey = `${key}:v${version}`;
    return this.get(versionedKey);
  }

  async setWithVersion(key, value, version, ttl) {
    const versionedKey = `${key}:v${version}`;
    return this.set(versionedKey, value, ttl);
  }

 async increment(key) {
  if (isRedisAvailable()) {
    return await redisClient.incr(key);
  }

  const current = memoryCache.get(key) || 0;
  const next = current + 1;
  memoryCache.set(key, next, 3600);
  return next;
}

  async clear() {
    if (isRedisAvailable()) {
      await redisClient.flushDb();
      return;
    }

    memoryCache.clear();
  }
}

export default new CacheManager();
