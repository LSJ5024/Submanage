import Redis from 'ioredis';

import { logger } from '../middlewares/logger.js';

export const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
  lazyConnect: true,
  retryStrategy(times) {
    if (times > 3) return null;
    return Math.min(times * 200, 2000);
  },
});

redis.on('connect', () => logger.info({ action: 'redis.connected' }));
redis.on('error', (err: Error) => logger.error({ action: 'redis.error', message: err.message }));
