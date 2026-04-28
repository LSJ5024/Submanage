import compression from 'compression';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { errorHandler } from './middlewares/errorHandler.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { httpLogger } from './middlewares/logger.js';
import { authRouter } from './routes/auth.routes.js';
import { subscriptionRouter } from './routes/subscription.routes.js';
import { cardRouter } from './routes/card.routes.js';
import { notificationRouter } from './routes/notification.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { adminRouter }    from './routes/admin.routes.js';
import { internalRouter } from './routes/internal.routes.js';

const app = express();

// ── 보안 미들웨어 ─────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? ['http://localhost:3001'],
    credentials: true,
  }),
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

// ── 공통 미들웨어 ─────────────────────────────────────────────
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(requestIdMiddleware);
app.use(httpLogger);

// ── 라우터 ────────────────────────────────────────────────────
const API_PREFIX = '/api/v1';
app.use(`${API_PREFIX}/auth`, authRouter);
app.use(`${API_PREFIX}/subscriptions`, subscriptionRouter);
app.use(`${API_PREFIX}/cards`, cardRouter);
app.use(`${API_PREFIX}/notifications`, notificationRouter);
app.use(`${API_PREFIX}/dashboard`, dashboardRouter);
app.use(`${API_PREFIX}/admin`,    adminRouter);
// 내부 전용 (Lambda 스케줄러 호출, X-Scheduler-Key 인증)
app.use('/internal', internalRouter);

// ── 헬스 체크 ─────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── 글로벌 에러 핸들러 (반드시 마지막에 등록) ───────────────────
app.use(errorHandler);

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.info(`SubTrack API 서버 시작: http://localhost:${PORT}`);
});

export default app;
