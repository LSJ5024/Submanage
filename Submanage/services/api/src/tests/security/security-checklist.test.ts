/**
 * 보안 취약점 자동 점검 (TASK-051)
 * CLAUDE.md §7, PRD §6.2, OWASP Top 10 기준
 */

import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';

jest.mock('../../lib/prisma.js', () => ({ prisma: { subscription: { findFirst: jest.fn(() => null), findMany: jest.fn(() => []) }, user: { findFirst: jest.fn(() => null), create: jest.fn((q: any) => ({ id: 'u1', ...q.data })) }, $transaction: jest.fn(() => []) } }));
jest.mock('../../lib/redis.js', () => ({ redis: { get: jest.fn(() => null), setex: jest.fn(), del: jest.fn(), on: jest.fn() } }));

import { authRouter }         from '../../routes/auth.routes.js';
import { subscriptionRouter } from '../../routes/subscription.routes.js';
import { adminRouter }        from '../../routes/admin.routes.js';
import { errorHandler }       from '../../middlewares/errorHandler.js';

process.env.JWT_ACCESS_SECRET  = 'test_secret_minimum_32_characters_long';
process.env.JWT_REFRESH_SECRET = 'test_refresh_minimum_32_characters_long';
process.env.ENCRYPTION_KEY     = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/auth',          authRouter);
  app.use('/api/v1/subscriptions', subscriptionRouter);
  app.use('/api/v1/admin',         adminRouter);
  app.use(errorHandler);
  return app;
}

function makeToken(userId = 'u1', role: 'USER' | 'ADMIN' = 'USER') {
  return jwt.sign({ userId, email: 'e@e.com', role }, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: '1h', algorithm: 'HS256',
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// OWASP A01: 접근 제어 실패 (Broken Access Control)
// ═══════════════════════════════════════════════════════════════════════════
describe('OWASP A01 — 접근 제어 실패 방지', () => {
  const app = buildApp();

  it('인증 없이 보호 API 접근 → 401', async () => {
    const endpoints = [
      { method: 'get',   path: '/api/v1/subscriptions' },
      { method: 'post',  path: '/api/v1/subscriptions' },
      { method: 'patch', path: '/api/v1/subscriptions/any-id/status' },
    ];
    for (const { method, path } of endpoints) {
      const res = await (request(app) as any)[method](path);
      expect(res.status).toBe(401);
    }
  });

  it('일반 사용자가 Admin API 접근 → 403', async () => {
    const token = makeToken('u1', 'USER');
    const res = await request(app)
      .post('/api/v1/admin/cancel-guides')
      .set('Authorization', `Bearer ${token}`)
      .send({ catalogId: 'cat-1', steps: [] });
    expect(res.status).toBe(403);
  });

  it('타인 리소스 접근 → 403 (IDOR 방지)', async () => {
    const { prisma } = require('../../lib/prisma.js');
    prisma.subscription.findFirst.mockResolvedValueOnce({
      id: 'sub-victim', user_id: 'victim-user', status: 'ACTIVE',
    });
    const attackerToken = makeToken('attacker-user');
    const res = await request(app)
      .get('/api/v1/subscriptions/sub-victim')
      .set('Authorization', `Bearer ${attackerToken}`);
    expect(res.status).toBe(403);
  });

  it('만료된 JWT → 401', async () => {
    const expiredToken = jwt.sign(
      { userId: 'u1', email: 'e@e.com', role: 'USER' },
      process.env.JWT_ACCESS_SECRET!,
      { expiresIn: '-1s', algorithm: 'HS256' },
    );
    const res = await request(app)
      .get('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('잘못된 JWT 서명 → 401', async () => {
    const forgedToken = jwt.sign({ userId: 'u1', email: 'e@e.com', role: 'ADMIN' }, 'wrong_secret');
    const res = await request(app)
      .get('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${forgedToken}`);
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OWASP A02: 암호화 실패 (Cryptographic Failures)
// ═══════════════════════════════════════════════════════════════════════════
describe('OWASP A02 — 암호화 실패 방지', () => {
  it('AES-256 암호화 유틸 — 복호화 검증', () => {
    const { encrypt, decrypt } = require('@subtrack/shared');
    const plain = '카드 결제 넷플릭스 17,000원';
    const encrypted = encrypt(plain);

    // 암호화된 값이 평문과 달라야 함
    expect(encrypted).not.toBe(plain);
    // 복호화 후 원본과 일치해야 함
    expect(decrypt(encrypted)).toBe(plain);
    // IV가 랜덤이므로 같은 평문도 다른 암호문 생성
    expect(encrypt(plain)).not.toBe(encrypted);
  });

  it('bcrypt 해시가 평문과 달라야 한다', async () => {
    const bcrypt = require('bcrypt');
    const password = 'MySecretPassword123!';
    const hashed = await bcrypt.hash(password, 12);

    expect(hashed).not.toBe(password);
    expect(hashed).toMatch(/^\$2[ab]\$12\$/); // salt rounds 12 확인
    expect(await bcrypt.compare(password, hashed)).toBe(true);
  });

  it('회원가입 응답에 비밀번호가 포함되지 않아야 한다', async () => {
    const app = buildApp();
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ email: 'sec@test.com', password: 'SecurePass123!', name: '보안테스트' });

    const body = JSON.stringify(res.body);
    expect(body).not.toContain('SecurePass123!');
    expect(body).not.toContain('password');
    expect(body).not.toContain('hashed');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OWASP A03: 인젝션 (Injection)
// ═══════════════════════════════════════════════════════════════════════════
describe('OWASP A03 — SQL Injection / XSS 방지', () => {
  const app = buildApp();
  const token = makeToken();

  it('SQL Injection 패턴 입력 시 Zod 유효성 검증으로 차단', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({
        email: "'; DROP TABLE users; --",
        password: 'pass',
        name: 'hacker',
      });
    // Zod email validation으로 400 반환 (ORM 파라미터 바인딩으로 인젝션 차단)
    expect(res.status).toBe(400);
  });

  it('XSS 패턴이 포함된 구독명 — JSON으로 저장되어 스크립트 실행 불가', async () => {
    const { prisma } = require('../../lib/prisma.js');
    const xssPayload = '<script>alert("XSS")</script>';
    prisma.subscription.create.mockResolvedValueOnce({
      id: 'sub-xss', service_name: xssPayload, user_id: 'u1',
    });

    const res = await request(app)
      .post('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${token}`)
      .send({
        user_id: 'u1', service_name: xssPayload,
        category: 'OTHER', amount: 0,
        billing_cycle: 'MONTHLY',
        next_billing_date: new Date().toISOString(),
        status: 'ACTIVE', auto_detected: false,
      });

    // 서버는 JSON으로 반환 — 클라이언트에서 innerHTML 사용하지 않으면 XSS 불가
    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toContain('application/json');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// OWASP A07: 인증 실패 (Identification and Authentication Failures)
// ═══════════════════════════════════════════════════════════════════════════
describe('OWASP A07 — 인증 실패 방지', () => {
  const app = buildApp();

  it('Authorization 헤더 없음 → 401 (Bearer 토큰 필수)', async () => {
    const res = await request(app).get('/api/v1/subscriptions');
    expect(res.status).toBe(401);
  });

  it('Bearer 없이 토큰만 전달 → 401', async () => {
    const res = await request(app)
      .get('/api/v1/subscriptions')
      .set('Authorization', makeToken());
    expect(res.status).toBe(401);
  });

  it('none 알고리즘 JWT → 401 (알고리즘 고정 검증)', async () => {
    // none 알고리즘 토큰 수동 생성
    const header  = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ userId: 'u1', email: 'e@e.com', role: 'ADMIN' })).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const res = await request(app)
      .get('/api/v1/subscriptions')
      .set('Authorization', `Bearer ${noneToken}`);
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CLAUDE.md §8 — 절대 구현 금지 항목 검증
// ═══════════════════════════════════════════════════════════════════════════
describe('CLAUDE.md §8 — 절대 금지 기능 미구현 확인', () => {
  it('자동 해지 실행 엔드포인트가 없어야 한다', async () => {
    const app = buildApp();
    const token = makeToken();
    const endpoints = [
      '/api/v1/subscriptions/sub-1/auto-cancel',
      '/api/v1/subscriptions/sub-1/execute-cancel',
      '/api/v1/cancel/execute',
    ];
    for (const path of endpoints) {
      const res = await request(app).post(path).set('Authorization', `Bearer ${token}`);
      // 404 또는 405가 반환되어야 함 (해당 라우트가 존재하지 않음)
      expect([404, 405]).toContain(res.status);
    }
  });

  it('직접 결제 대행 엔드포인트가 없어야 한다', async () => {
    const app = buildApp();
    const token = makeToken();
    const res = await request(app)
      .post('/api/v1/payments/execute')
      .set('Authorization', `Bearer ${token}`)
      .send({ amount: 17000 });
    expect([404, 405]).toContain(res.status);
  });
});
