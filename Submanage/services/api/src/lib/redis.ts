import Redis from 'ioredis';

import { logger } from '../middlewares/logger.js';

/**
 * Redis 클라이언트
 * - 로컬/Railway: REDIS_URL (redis://...)
 * - Upstash:      REDIS_URL (rediss://... TLS 포함)
 *
 * Upstash 무료 티어: 10,000 commands/day
 * Upstash Console → 프로젝트 생성 → REDIS_URL 복사
 */
const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

// Upstash는 TLS 필요 (rediss://)
const isTls = REDIS_URL.startsWith('rediss://');

export const redis = new Redis(REDIS_URL, {
  lazyConnect: true,
  tls: isTls ? {} : undefined,
  retryStrategy(times) {
    if (times > 3) return null;
    return Math.min(times * 200, 2000);
  },
  maxRetriesPerRequest: 3,
});

redis.on('connect', () => logger.info({ action: 'redis.connected' }));
redis.on('error',   (err: Error) => logger.error({ action: 'redis.error', message: err.message }));
