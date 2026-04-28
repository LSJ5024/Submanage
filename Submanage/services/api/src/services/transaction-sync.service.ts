import axios from 'axios';

import { encrypt } from '@subtrack/shared';
import { prisma } from '../lib/prisma.js';
import { logger } from '../middlewares/logger.js';
import { MyDataConnector } from './mydata/mydata.connector.js';

interface DetectedSubscription {
  service_name: string;
  category: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  confidence_score: number;
  catalog_id?: string;
  is_unknown: boolean;
}

/**
 * TransactionSyncService — 결제 내역 수신 → 암호화 저장 → AI 탐지 요청 → 구독 upsert
 * CLAUDE.md §4: AI 엔진은 반드시 이 서비스를 통해서만 내부 호출
 */
export class TransactionSyncService {
  private readonly mydata = new MyDataConnector();
  private readonly aiEngineUrl = process.env.AI_ENGINE_URL ?? 'http://localhost:8000';
  private readonly aiSecret = process.env.AI_ENGINE_INTERNAL_SECRET ?? '';

  /** 최초 연동 시 12개월치 결제 내역 동기화 */
  async syncInitial(userId: string, cardId: string): Promise<void> {
    const toDate = new Date().toISOString().split('T')[0]!;
    const fromDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0]!;

    await this.sync(userId, cardId, fromDate, toDate);
    logger.info({ action: 'transaction.sync.initial.done', userId, cardId });
  }

  /** 증분 동기화 (Lambda Scheduler 매일 자정 호출) */
  async syncIncremental(userId: string, cardId: string): Promise<void> {
    const toDate = new Date().toISOString().split('T')[0]!;
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    await this.sync(userId, cardId, yesterday, toDate);
  }

  // ── Private ────────────────────────────────────────────────────────────────

  private async sync(
    userId: string,
    cardId: string,
    fromDate: string,
    toDate: string,
  ): Promise<void> {
    // 1. 마이데이터 API에서 결제 내역 수신
    const rawTransactions = await this.mydata.fetchTransactions(userId, fromDate, toDate);
    if (!rawTransactions.length) return;

    // 2. AES-256 암호화 후 transactions 테이블 저장 (CLAUDE.md §7)
    // @@unique([card_id, transaction_date, amount_encrypted]) 로 중복 방지
    const saved: (typeof rawTransactions[0] & { id: string })[] = [];
    for (const tx of rawTransactions) {
      const encryptedAmount = encrypt(String(tx.amount));
      const txDate = new Date(tx.transactionDate);

      const existing = await prisma.transaction.findFirst({
        where: {
          card_id: cardId,
          transaction_date: txDate,
          amount_encrypted: encryptedAmount,
        },
      });

      if (!existing) {
        const created = await prisma.transaction.create({
          data: {
            user_id: userId,
            card_id: cardId,
            merchant_name_encrypted: encrypt(tx.merchantName),
            amount_encrypted: encryptedAmount,
            transaction_date: txDate,
          },
        });
        saved.push({ ...tx, id: created.id });
      }
    }

    logger.info({ action: 'transaction.saved', userId, count: saved.length });

    // 3. AI 엔진 내부 HTTP 호출로 구독 탐지 요청 (CLAUDE.md §4 — AI 엔진 외부 직접 노출 금지)
    const detected = await this.requestAiDetection(
      saved.map((tx) => ({
        transaction_id: tx.id,
        merchant_name_encrypted: tx.merchant_name_encrypted,
        amount_encrypted: tx.amount_encrypted,
        transaction_date: tx.transaction_date,
        card_id: cardId,
        user_id: userId,
      })),
    );

    // 4. 탐지 결과 subscriptions 테이블 upsert
    if (detected.length) {
      await this.upsertSubscriptions(userId, detected);
    }
  }

  /** AI 엔진 내부 호출 — X-Internal-Secret 헤더로 인증 */
  private async requestAiDetection(transactions: unknown[]): Promise<DetectedSubscription[]> {
    try {
      const response = await axios.post<{ detected: DetectedSubscription[] }>(
        `${this.aiEngineUrl}/internal/detect`,
        { transactions },
        { headers: { 'x-internal-secret': this.aiSecret }, timeout: 60_000 },
      );
      return response.data.detected;
    } catch (err) {
      logger.error({ action: 'ai.detect.error', message: (err as Error).message });
      return [];
    }
  }

  /** 탐지된 구독 upsert (신규 탐지 시 DETECTED 상태로 생성) */
  private async upsertSubscriptions(
    userId: string,
    detected: DetectedSubscription[],
  ): Promise<void> {
    for (const sub of detected) {
      const existing = await prisma.subscription.findFirst({
        where: {
          user_id: userId,
          service_name: sub.service_name,
          deleted_at: null,
        },
      });

      if (!existing) {
        await prisma.subscription.create({
          data: {
            user_id: userId,
            service_name: sub.service_name,
            category: sub.category as Parameters<typeof prisma.subscription.create>[0]['data']['category'],
            amount: sub.amount,
            currency: sub.currency,
            billing_cycle: sub.billing_cycle as Parameters<typeof prisma.subscription.create>[0]['data']['billing_cycle'],
            next_billing_date: this.estimateNextBillingDate(sub.billing_cycle),
            status: 'DETECTED',
            auto_detected: true,
            catalog_id: sub.catalog_id ?? null,
          },
        });

        logger.info({ action: 'subscription.detected', userId, service: sub.service_name });
      }
    }
  }

  private estimateNextBillingDate(billingCycle: string): Date {
    const now = new Date();
    const days: Record<string, number> = {
      WEEKLY: 7,
      MONTHLY: 30,
      QUARTERLY: 90,
      SEMI_ANNUAL: 180,
      ANNUAL: 365,
    };
    now.setDate(now.getDate() + (days[billingCycle] ?? 30));
    return now;
  }
}
