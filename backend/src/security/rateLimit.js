import { RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS } from "../config/env.js";

const requests = new Map();

export const checkRateLimit = (key) => {
  const now = Date.now();
  const bucket = requests.get(key);

  if (!bucket || now > bucket.resetAt) {
    requests.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return { allowed: true, remaining: RATE_LIMIT_MAX - 1, resetAt: now + RATE_LIMIT_WINDOW_MS };
  }

  if (bucket.count >= RATE_LIMIT_MAX) {
    return { allowed: false, remaining: 0, resetAt: bucket.resetAt };
  }

  bucket.count += 1;
  return { allowed: true, remaining: RATE_LIMIT_MAX - bucket.count, resetAt: bucket.resetAt };
};
