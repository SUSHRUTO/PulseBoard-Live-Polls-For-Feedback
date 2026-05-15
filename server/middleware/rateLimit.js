const rateLimit = require("express-rate-limit");
const { createClient } = require("redis");
const env = require("../config/env");

let redisClient = null;
let redisReady = false;

class SimpleRedisStore {
  constructor({ prefix = "rl:", windowMs }) {
    this.prefix = prefix;
    this.windowMs = windowMs;
  }

  async increment(key) {
    const redisKey = `${this.prefix}${key}`;
    const totalHits = await redisClient.incr(redisKey);
    if (totalHits === 1) {
      await redisClient.pExpire(redisKey, this.windowMs);
    }
    const ttl = await redisClient.pTTL(redisKey);
    return {
      totalHits,
      resetTime: new Date(Date.now() + Math.max(ttl, 0))
    };
  }

  async decrement(key) {
    await redisClient.decr(`${this.prefix}${key}`);
  }

  async resetKey(key) {
    await redisClient.del(`${this.prefix}${key}`);
  }
}

async function initRedis() {
  if (!env.redisUrl || redisClient) return redisReady;

  redisClient = createClient({ url: env.redisUrl });
  redisClient.on("error", (error) => {
    redisReady = false;
    console.warn("Redis rate-limit connection error:", error.message);
  });

  try {
    await redisClient.connect();
    redisReady = true;
    console.log("Redis rate limiting connected.");
  } catch (error) {
    redisReady = false;
    console.warn("Redis unavailable, using in-memory rate limits:", error.message);
  }

  return redisReady;
}

function limiter({ windowMs, max, prefix, message }) {
  const options = {
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message }
  };

  if (redisReady && redisClient) {
    options.store = new SimpleRedisStore({ prefix, windowMs });
  }

  return rateLimit(options);
}

function authLimiter() {
  return limiter({
    windowMs: 15 * 60 * 1000,
    max: 30,
    prefix: "auth:",
    message: "Too many authentication attempts. Please wait and try again."
  });
}

function pollSubmissionLimiter() {
  return limiter({
    windowMs: 5 * 60 * 1000,
    max: 20,
    prefix: "submit:",
    message: "Too many poll submissions from this network. Please wait and try again."
  });
}

function apiLimiter() {
  return limiter({
    windowMs: 60 * 1000,
    max: 180,
    prefix: "api:",
    message: "Too many requests. Please slow down."
  });
}

module.exports = {
  initRedis,
  authLimiter,
  pollSubmissionLimiter,
  apiLimiter
};
