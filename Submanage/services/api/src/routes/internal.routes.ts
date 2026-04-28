import { Router, type Request, type Response, type NextFunction } from 'express';

import { NotificationScheduler } from '../services/notification/notification.scheduler.js';
import { TransactionSyncService } from '../services/transaction-sync.service.js';
import { prisma } from '../lib/prisma.js';
import { logger } from '../middlewares/logger.js';
import { successResponse } from '@subtrack/shared';

export const internalRouter = Router();

/** Lambda 스케줄러 전용 내부 인증 미들웨어 */
function verifySchedulerKey(req: Request, res: Response, next: NextFunction): void {
  const key = req.headers['x-scheduler-key'];
  const expected = process.env.SCHEDULER_SECRET;

  if (!expected) {
    logger.error({ action: 'scheduler.key.missing', message: 'SCHEDULER_SECRET 환경변수 미설정' });
    res.status(500).json({ success: false, error: 'SCHEDULER_SECRET not configured' });
    return;
  }
  if (key !== expected) {
    res.status(403).json({ success: false, error: 'Unauthorized' });
    return;
  }
  next();
}

internalRouter.use(verifySchedulerKey);

/** D-3 알림 스케줄러 트리거 (Lambda EventBridge → 매일 오전 10시) */
internalRouter.post('/scheduler/notifications', async (_req, res, next) => {
  try {
    const scheduler = new NotificationScheduler();
    await scheduler.runDailyCheck();
    logger.info({ action: 'internal.scheduler.notifications.done' });
    res.json(successResponse({ message: '알림 스케줄러 완료' }));
  } catch (err) {
    next(err);
  }
});

/** 마이데이터 증분 동기화 트리거 (Lambda EventBridge → 매일 자정) */
internalRouter.post('/scheduler/sync', async (_req, res, next) => {
  try {
    const syncService = new TransactionSyncService();

    // 활성 카드 전체 증분 동기화
    const cards = await prisma.card.findMany({ where: { is_active: true } });
    const results = await Promise.allSettled(
      cards.map((card) => syncService.syncIncremental(card.user_id, card.id)),
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed    = results.filter((r) => r.status === 'rejected').length;

    logger.info({ action: 'internal.scheduler.sync.done', total: cards.length, succeeded, failed });
    res.json(successResponse({ total: cards.length, succeeded, failed }));
  } catch (err) {
    next(err);
  }
});
