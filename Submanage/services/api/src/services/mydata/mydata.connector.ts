import axios, { type AxiosInstance } from 'axios';

import { encrypt, decrypt } from '@subtrack/shared';
import { redis } from '../../lib/redis.js';
import { logger } from '../../middlewares/logger.js';
import { AppError } from '../../common/errors.js';

const MYDATA_TOKEN_PREFIX = 'mydata:token:';
const TOKEN_REFRESH_THRESHOLD_SEC = 300; // 만료 5분 전 선제 갱신

interface MyDataTokenSet {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix timestamp (seconds)
}

interface RawTransaction {
  merchantName: string;
  amount: number;
  transactionDate: string;
  cardId: string;
}

/**
 * MyData API connector.
 * Handles OAuth 2.0 auth, token management, and transaction sync.
 * CLAUDE.md §9 — 토큰 Redis 암호화 저장, Exponential Backoff 재시도
 */
export class MyDataConnector {
  private readonly client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: process.env.MYDATA_API_BASE_URL ?? 'https://api.mydata.go.kr',
      timeout: 30_000,
    });
  }

  /** OAuth 인가 코드로 Access/Refresh Token 발급 후 Redis에 암호화 저장 */
  async authorize(userId: string, authCode: string): Promise<void> {
    const data = await this.withRetry(() =>
      this.client.post<{ access_token: string; refresh_token: string; expires_in: number }>(
        '/v1/oauth/token',
        {
          grant_type: 'authorization_code',
          code: authCode,
          client_id: process.env.MYDATA_CLIENT_ID,
          client_secret: process.env.MYDATA_CLIENT_SECRET,
        },
      ),
    );

    await this.saveToken(userId, {
      accessToken: data.data.access_token,
      refreshToken: data.data.refresh_token,
      expiresAt: Math.floor(Date.now() / 1000) + data.data.expires_in,
    });

    logger.info({ action: 'mydata.authorize.success', userId });
  }

  /** Redis에서 유효한 Access Token 조회 (만료 임박 시 자동 갱신) */
  async getValidAccessToken(userId: string): Promise<string> {
    const tokenSet = await this.loadToken(userId);
    if (!tokenSet) {
      throw new AppError(401, 'MYDATA_AUTH_REQUIRED', '마이데이터 재인증이 필요합니다.');
    }

    const now = Math.floor(Date.now() / 1000);
    if (tokenSet.expiresAt - now < TOKEN_REFRESH_THRESHOLD_SEC) {
      return this.refreshAccessToken(userId, tokenSet.refreshToken);
    }

    return tokenSet.accessToken;
  }

  /** 결제 내역 조회 (최초 12개월치 or 증분) */
  async fetchTransactions(
    userId: string,
    fromDate: string,
    toDate: string,
  ): Promise<RawTransaction[]> {
    const accessToken = await this.getValidAccessToken(userId);

    const response = await this.withRetry(() =>
      this.client.get<{ transactions: RawTransaction[] }>('/v1/transactions', {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: { from_date: fromDate, to_date: toDate },
      }),
    );

    logger.info({
      action: 'mydata.fetch.transactions',
      userId,
      count: response.data.transactions.length,
    });

    return response.data.transactions;
  }

  /** 토큰 삭제 (카드 연동 해제 시) */
  async revokeToken(userId: string): Promise<void> {
    await redis.del(`${MYDATA_TOKEN_PREFIX}${userId}`);
    logger.info({ action: 'mydata.token.revoked', userId });
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async refreshAccessToken(userId: string, refreshToken: string): Promise<string> {
    try {
      const data = await this.withRetry(() =>
        this.client.post<{ access_token: string; expires_in: number }>('/v1/oauth/token', {
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
          client_id: process.env.MYDATA_CLIENT_ID,
          client_secret: process.env.MYDATA_CLIENT_SECRET,
        }),
      );

      const tokenSet = await this.loadToken(userId);
      await this.saveToken(userId, {
        accessToken: data.data.access_token,
        refreshToken: tokenSet?.refreshToken ?? refreshToken,
        expiresAt: Math.floor(Date.now() / 1000) + data.data.expires_in,
      });

      logger.info({ action: 'mydata.token.refreshed', userId });
      return data.data.access_token;
    } catch {
      await this.revokeToken(userId);
      throw new AppError(401, 'MYDATA_REAUTH_REQUIRED', '마이데이터 재인증이 필요합니다.');
    }
  }

  /** Redis에 토큰 AES-256 암호화 저장 (CLAUDE.md §7) */
  private async saveToken(userId: string, tokenSet: MyDataTokenSet): Promise<void> {
    const encrypted = encrypt(JSON.stringify(tokenSet));
    const ttl = tokenSet.expiresAt - Math.floor(Date.now() / 1000) + 86_400; // refresh 여유분 +1일
    await redis.setex(`${MYDATA_TOKEN_PREFIX}${userId}`, ttl, encrypted);
  }

  /** Redis에서 토큰 복호화 조회 */
  private async loadToken(userId: string): Promise<MyDataTokenSet | null> {
    const raw = await redis.get(`${MYDATA_TOKEN_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(decrypt(raw)) as MyDataTokenSet;
  }

  /**
   * Exponential Backoff 재시도 (최대 3회, CLAUDE.md §9).
   * 지수 간격: 1s → 2s → 4s
   */
  private async withRetry<T>(fn: () => Promise<T>, maxAttempts = 3): Promise<T> {
    let lastError: Error = new Error('Unknown error');
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err as Error;
        if (attempt < maxAttempts) {
          const delay = Math.pow(2, attempt - 1) * 1000;
          logger.warn({ action: 'mydata.retry', attempt, delay });
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    }
    throw lastError;
  }
}
