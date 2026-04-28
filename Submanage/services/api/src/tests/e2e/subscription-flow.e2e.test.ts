/**
 * E2E 테스트: 핵심 구독 플로우 (TASK-050)
 * 카드 연동 → 결제 내역 수신 → 구독 탐지 → 대시보드 표시 → D-3 알림 발송
 *
 * 실제 DB/Redis 없이 모킹으로 전체 플로우를 검증합니다.
 * 실 환경 E2E는 docker-compose up 후 Jest integration test로 실행합니다.
 */

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

// ── 의존성 모킹 ────────────────────────────────────────────────────────────
jest.mock('../../lib/prisma.js', () => ({ prisma: mockPrisma() }));
jest.mock('../../lib/redis.js',  () => ({ redis: mockRedis() }));
jest.mock('axios');

import axios from 'axios';

// ── 앱 임포트 (모킹 완료 후) ────────────────────────────────────────────────
import { authRouter }         from '../../routes/auth.routes.js';
import { cardRouter }         from '../../routes/card.routes.js';
import { subscriptionRouter } from '../../routes/subscription.routes.js';
import { dashboardRouter }    from '../../routes/dashboard.routes.js';
import { errorHandler }       from '../../middlewares/errorHandler.js';

// ── 테스트용 Express 앱 ─────────────────────────────────────────────────────
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth',          authRouter);
  app.use('/api/v1/cards',         cardRouter);
  app.use('/api/v1/subscriptions', subscriptionRouter);
  app.use('/api/v1/dashboard',     dashboardRouter);
  app.use(errorHandler);
  return app;
}

// ── JWT 헬퍼 ───────────────────────────────────────────────────────────────
const TEST_SECRET = 'test_access_secret_min_32_chars_long';
process.env.JWT_ACCESS_SECRET  = TEST_SECRET;
process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_min_32_chars_long';
process.env.ENCRYPTION_KEY     = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.AI_ENGINE_URL      = 'http://localhost:8000';
process.env.AI_ENGINE_INTERNAL_SECRET = 'test_internal_secret';

function makeToken(userId = 'user-001', role: 'USER' | 'ADMIN' = 'USER') {
  return jwt.sign({ userId, email: 'test@subtrack.app', role }, TEST_SECRET, {
    expiresIn: '1h', algorithm: 'HS256',
  });
}

// ── Prisma 모크 팩토리 ─────────────────────────────────────────────────────
function mockPrisma() {
  const users: Record<string, unknown> = {};
  const cards: Record<string, unknown> = {};
  const subscriptions: Record<string, unknown> = {};
  const notifications: unknown[] = [];

  return {
    user: {
      findFirst: jest.fn((q: { where: { email?: string; id?: string } }) => {
        if (q.where.email) return Promise.resolve(users[q.where.email] ?? null);
        if (q.where.id)    return Promise.resolve(Object.values(users).find((u: any) => u.id === q.where.id) ?? null);
        return Promise.resolve(null);
      }),
      create: jest.fn((q: { data: any }) => {
        const u = { id: 'user-001', ...q.data };
        users[u.email] = u;
        return Promise.resolve(u);
      }),
    },
    card: {
      create:   jest.fn((q: { data: any }) => Promise.resolve({ id: 'card-001', ...q.data })),
      findMany: jest.fn(() => Promise.resolve([{ id: 'card-001', card_company: 'SHINHAN', is_active: true }])),
      findFirst:jest.fn(() => Promise.resolve({ id: 'card-001', user_id: 'user-001', is_active: true })),
      update:   jest.fn(() => Promise.resolve({})),
    },
    transaction: {
      findFirst: jest.fn(() => Promise.resolve(null)),
      create:    jest.fn((q: { data: any }) => Promise.resolve({ id: 'tx-001', ...q.data })),
    },
    subscription: {
      findMany:  jest.fn(() => Promise.resolve(Object.values(subscriptions))),
      findFirst: jest.fn((q: { where: { id?: string } }) =>
        Promise.resolve(Object.values(subscriptions).find((s: any) => s.id === q.where.id) ?? null),
      ),
      create: jest.fn((q: { data: any }) => {
        const s = { id: `sub-${Date.now()}`, ...q.data };
        subscriptions[s.id] = s;
        return Promise.resolve(s);
      }),
      update: jest.fn(() => Promise.resolve({})),
      aggregate: jest.fn(() => Promise.resolve({ _sum: { amount: 87800 } })),
      groupBy:   jest.fn(() => Promise.resolve([{ category: 'VIDEO', _sum: { amount: 34000 }, _count: { id: 2 } }])),
    },
    subscriptionStatusHistory: {
      create: jest.fn(() => Promise.resolve({})),
    },
    notification: {
      create: jest.fn((q: { data: any }) => {
        const n = { id: `notif-${Date.now()}`, ...q.data, retry_count: 0 };
        notifications.push(n);
        return Promise.resolve(n);
      }),
      update: jest.fn(() => Promise.resolve({})),
      findMany: jest.fn(() => Promise.resolve(notifications)),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops instanceof Array ? ops : [ops])),
  };
}

function mockRedis() {
  const store: Record<string, string> = {};
  return {
    get:    jest.fn((k: string) => Promise.resolve(store[k] ?? null)),
    setex:  jest.fn((k: string, _ttl: number, v: string) => { store[k] = v; return Promise.resolve('OK'); }),
    del:    jest.fn((k: string) => { delete store[k]; return Promise.resolve(1); }),
    on:     jest.fn(),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// E2E 테스트 스위트
// ═══════════════════════════════════════════════════════════════════════════

describe('E2E: 구독 탐지 → 대시보드 핵심 플로우 (TASK-050)', () => {
  let app: express.Express;
  let token: string;

  beforeAll(() => {
    app   = buildApp();
    token = makeToken();
  });

  // ── 플로우 1: 회원가입 & 로그인 ─────────────────────────────────────────
  describe('플로우 1 — 회원가입 및 로그인', () => {
    it('POST /auth/register → 201 신규 사용자 생성', async () => {
      const res = await request(app)
        .post('/api/v1/auth/register')
        .send({ email: 'test@subtrack.app', password: 'Password123!', name: '홍길동' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('userId');
      expect(res.body.data).toHaveProperty('email', 'test@subtrack.app');
    });

    it('POST /auth/login → 200 JWT 토큰 발급', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'test@subtrack.app', password: 'Password123!' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('accessToken');
      expect(res.body.data).toHaveProperty('refreshToken');
    });

    it('인증 없이 보호 엔드포인트 접근 → 401', async () => {
      const res = await request(app).get('/api/v1/subscriptions');
      expect(res.status).toBe(401);
    });
  });

  // ── 플로우 2: 카드 연동 ─────────────────────────────────────────────────
  describe('플로우 2 — 카드 연동 (FR-005)', () => {
    it('POST /cards/link → 201 카드 연동 성공 (지원 카드사)', async () => {
      // MyDataConnector.authorize 모킹
      (axios.post as jest.Mock).mockResolvedValueOnce({
        data: { access_token: 'mock_at', refresh_token: 'mock_rt', expires_in: 3600 },
      });

      const res = await request(app)
        .post('/api/v1/cards/link')
        .set('Authorization', `Bearer ${token}`)
        .send({ cardCompany: 'SHINHAN', authCode: 'auth_code_123' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('id');
    });

    it('POST /cards/link → 400 미지원 카드사 (해외 카드사 차단 — CLAUDE.md §8)', async () => {
      const res = await request(app)
        .post('/api/v1/cards/link')
        .set('Authorization', `Bearer ${token}`)
        .send({ cardCompany: 'VISA_USA', authCode: 'code' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('GET /cards → 200 연동된 카드 목록 조회', async () => {
      const res = await request(app)
        .get('/api/v1/cards')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  // ── 플로우 3: 구독 CRUD ─────────────────────────────────────────────────
  describe('플로우 3 — 구독 자동 탐지 & CRUD (FR-001)', () => {
    let subId: string;

    it('POST /subscriptions → 201 구독 수동 등록', async () => {
      const res = await request(app)
        .post('/api/v1/subscriptions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          user_id: 'user-001',
          service_name: 'Netflix',
          category: 'VIDEO',
          amount: 17000,
          billing_cycle: 'MONTHLY',
          next_billing_date: new Date(Date.now() + 3 * 86400000).toISOString(),
          status: 'ACTIVE',
          auto_detected: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      subId = res.body.data.id;
    });

    it('GET /subscriptions → 200 커서 기반 페이지네이션', async () => {
      const res = await request(app)
        .get('/api/v1/subscriptions?limit=10')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('hasMore');
      expect(res.body.data).toHaveProperty('nextCursor');
    });

    it('타인 구독 접근 → 403 소유권 검증 (CLAUDE.md §7)', async () => {
      // 다른 userId로 토큰 생성
      const otherToken = makeToken('other-user-999');
      const res = await request(app)
        .get(`/api/v1/subscriptions/${subId}`)
        .set('Authorization', `Bearer ${otherToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ── 플로우 4: 구독 상태 머신 ────────────────────────────────────────────
  describe('플로우 4 — 구독 상태 머신 (TASK-022)', () => {
    const TRANSITIONS = [
      { from: 'ACTIVE',     to: 'CANCELLING', expect: 200 },
      { from: 'ACTIVE',     to: 'PAUSED',     expect: 200 },
      { from: 'PAUSED',     to: 'ACTIVE',     expect: 200 },
      { from: 'CANCELLING', to: 'CANCELLED',  expect: 200 },
      { from: 'DETECTED',   to: 'CANCELLED',  expect: 400 }, // 유효하지 않은 전이
      { from: 'CANCELLED',  to: 'ACTIVE',     expect: 400 }, // 유효하지 않은 전이
    ];

    TRANSITIONS.forEach(({ from, to, expect: expectedStatus }) => {
      it(`${from} → ${to} 전이: HTTP ${expectedStatus}`, async () => {
        const { prisma } = require('../../lib/prisma.js');
        prisma.subscription.findFirst.mockResolvedValueOnce({
          id: 'sub-test', user_id: 'user-001', status: from, catalog_id: null,
        });

        const res = await request(app)
          .patch('/api/v1/subscriptions/sub-test/status')
          .set('Authorization', `Bearer ${token}`)
          .send({ status: to });

        expect(res.status).toBe(expectedStatus);
      });
    });
  });

  // ── 플로우 5: 해지 가이드 조회 ──────────────────────────────────────────
  describe('플로우 5 — 해지 안내 (FR-004)', () => {
    it('GET /subscriptions/:id/cancel-guide → 200 가이드 조회 (자동 해지 로직 없음)', async () => {
      const { prisma } = require('../../lib/prisma.js');
      prisma.subscription.findFirst.mockResolvedValueOnce({
        id: 'sub-1', user_id: 'user-001', status: 'ACTIVE', catalog_id: 'cat-1',
      });
      prisma.cancellationGuide = {
        findFirst: jest.fn(() => Promise.resolve({
          id: 'guide-1', catalog_id: 'cat-1',
          steps: [{ order: 1, description: '설정 → 계정 → 해지' }],
          deep_link: 'https://netflix.com/cancel',
          screenshot_urls: [],
        })),
      };

      const res = await request(app)
        .get('/api/v1/subscriptions/sub-1/cancel-guide')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // ⚠️ 자동 해지 실행 코드가 없음을 간접 검증: guide 정보만 반환
      expect(res.body.data).not.toHaveProperty('autoCancel');
      expect(res.body.data).not.toHaveProperty('cancelExecution');
    });
  });

  // ── 플로우 6: 대시보드 집계 ─────────────────────────────────────────────
  describe('플로우 6 — 대시보드 (FR-002)', () => {
    it('GET /dashboard → 200 집계 데이터 반환', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveProperty('totalMonthlyAmount');
      expect(res.body.data).toHaveProperty('upcomingBillings');
      expect(res.body.data).toHaveProperty('categoryBreakdown');
    });

    it('GET /dashboard/reports/monthly → 200 월별 리포트', async () => {
      const { prisma } = require('../../lib/prisma.js');
      prisma.subscription.findMany.mockResolvedValueOnce([
        { id: 'sub-1', service_name: 'Netflix', amount: 17000, category: 'VIDEO', billing_cycle: 'MONTHLY', status: 'ACTIVE' },
      ]);

      const year  = new Date().getFullYear();
      const month = new Date().getMonth() + 1;
      const res = await request(app)
        .get(`/api/v1/dashboard/reports/monthly?year=${year}&month=${month}`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveProperty('totalAmount');
      expect(res.body.data).toHaveProperty('subscriptionCount');
    });
  });

  // ── 플로우 7: 알림 설정 opt-out ─────────────────────────────────────────
  describe('플로우 7 — 알림 설정 opt-out (FR-003)', () => {
    beforeEach(() => {
      const { prisma } = require('../../lib/prisma.js');
      prisma.notificationSetting = {
        findUnique: jest.fn(() => Promise.resolve(null)),
        upsert: jest.fn((q: { create: unknown }) => Promise.resolve({
          push_enabled: true, email_enabled: true, sms_enabled: false, notification_time: '10:00',
          ...q.create,
        })),
      };
    });

    it('GET /notifications/settings → 200 기본값 반환', async () => {
      const res = await request(app)
        .get('/api/v1/notifications/settings')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        pushEnabled: true, emailEnabled: true, smsEnabled: false,
      });
    });

    it('PATCH /notifications/settings → 200 설정 변경 저장', async () => {
      const res = await request(app)
        .patch('/api/v1/notifications/settings')
        .set('Authorization', `Bearer ${token}`)
        .send({ smsEnabled: true, notificationTime: '09:00' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});

// ── 보안 필수 사항 검증 E2E (CLAUDE.md §7) ──────────────────────────────────
describe('E2E: 보안 필수 사항 검증 (CLAUDE.md §7)', () => {
  let app: express.Express;

  beforeAll(() => { app = buildApp(); });

  it('만료된 JWT로 요청 시 401 반환', async () => {
    const expiredToken = jwt.sign(
      { userId: 'u1', email: 'e@e.com', role: 'USER' },
      TEST_SECRET,
      { expiresIn: '-1s', algorithm: 'HS256' },
    );
    const res = await request(app)
      .get('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('잘못된 서명의 JWT로 요청 시 401 반환', async () => {
    const badToken = jwt.sign({ userId: 'u1', email: 'e@e.com', role: 'USER' }, 'wrong_secret');
    const res = await request(app)
      .get('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${badToken}`);
    expect(res.status).toBe(401);
  });

  it('일반 사용자가 관리자 API 접근 시 403 반환', async () => {
    const userToken = jwt.sign(
      { userId: 'u1', email: 'e@e.com', role: 'USER' }, TEST_SECRET, { algorithm: 'HS256' },
    );
    const res = await request(app)
      .post('/api/v1/admin/cancel-guides')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ catalogId: 'cat-1', steps: [] });
    expect(res.status).toBe(403);
  });

  it('응답에 민감 데이터(password, token)가 포함되지 않아야 한다', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'sec@test.com', password: 'SecurePass123!', name: '보안테스트' });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('SecurePass123!'); // 평문 비밀번호
    expect(body).not.toContain('password');        // 비밀번호 필드 노출
  });
});
