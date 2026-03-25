import logger from "./logger.js";

/**
 * Simple in-memory cache with TTL (Time To Live)
 */
class Cache {
  constructor() {
    this.cache = new Map();
    this.timers = new Map();
  }

  /**
   * Set a value in cache with optional TTL (in seconds)
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in seconds (default: 3600 = 1 hour)
   */
  set(key, value, ttl = 3600) {
    // Clear existing timer if any
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
    }

    // Set the value
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl * 1000,
    });

    // Set timer to auto-delete
    const timer = setTimeout(() => {
      this.delete(key);
    }, ttl * 1000);

    this.timers.set(key, timer);
  }

  /**
   * Get a value from cache
   * @param {string} key - Cache key
   * @returns {any|null} - Cached value or null if not found/expired
   */
  get(key) {
    const item = this.cache.get(key);
    if (!item) return null;

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  /**
   * Delete a key from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    if (this.timers.has(key)) {
      clearTimeout(this.timers.get(key));
      this.timers.delete(key);
    }
    this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear() {
    // Clear all timers
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.cache.clear();
  }

  /**
   * Check if a key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const item = this.cache.get(key);
    if (!item) return false;

    // Check if expired
    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Get cache statistics
   * @returns {object}
   */
  getStats() {
    let expired = 0;
    const now = Date.now();

    this.cache.forEach((item) => {
      if (now > item.expiresAt) expired++;
    });

    return {
      size: this.cache.size,
      expired,
      active: this.cache.size - expired,
    };
  }
}

// Export singleton instance
export default new Cache();

