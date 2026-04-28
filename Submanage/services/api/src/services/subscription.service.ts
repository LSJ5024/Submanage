import type { SubscriptionStatus } from '@subtrack/shared';
import { BadRequestError, NotFoundError } from '../common/errors.js';
import { assertOwnership } from '../middlewares/auth.js';
import { SubscriptionRepository } from '../repositories/subscription.repository.js';
import { logger } from '../middlewares/logger.js';

// 유효한 상태 전이 맵 (TASK-022 상태 머신)
const VALID_TRANSITIONS: Record<string, string[]> = {
  DETECTED: ['ACTIVE'],
  ACTIVE: ['CANCELLING', 'PAUSED'],
  PAUSED: ['ACTIVE'],
  CANCELLING: ['CANCELLED', 'ACTIVE'],
  CANCELLED: [],
};

export class SubscriptionService {
  private readonly subscriptionRepo = new SubscriptionRepository();

  async list(params: { userId: string; cursor?: string; limit: number; sort?: string }) {
    return this.subscriptionRepo.findManyByUser(params);
  }

  async create(data: { userId: string; [key: string]: unknown }) {
    return this.subscriptionRepo.create(data);
  }

  async findOne(id: string, requestingUserId: string) {
    const subscription = await this.subscriptionRepo.findById(id);
    if (!subscription) throw new NotFoundError('해당 구독을 찾을 수 없습니다.');
    assertOwnership(requestingUserId, subscription.user_id);
    return subscription;
  }

  async update(id: string, requestingUserId: string, data: Record<string, unknown>) {
    const subscription = await this.subscriptionRepo.findById(id);
    if (!subscription) throw new NotFoundError('해당 구독을 찾을 수 없습니다.');
    assertOwnership(requestingUserId, subscription.user_id);
    return this.subscriptionRepo.update(id, data);
  }

  async remove(id: string, requestingUserId: string): Promise<void> {
    const subscription = await this.subscriptionRepo.findById(id);
    if (!subscription) throw new NotFoundError('해당 구독을 찾을 수 없습니다.');
    assertOwnership(requestingUserId, subscription.user_id);
    // 소프트 삭제 — DELETE 쿼리 직접 실행 금지 (CLAUDE.md §6)
    await this.subscriptionRepo.softDelete(id, requestingUserId);
  }

  async updateStatus(id: string, requestingUserId: string, toStatus: string) {
    const subscription = await this.subscriptionRepo.findById(id);
    if (!subscription) throw new NotFoundError('해당 구독을 찾을 수 없습니다.');
    assertOwnership(requestingUserId, subscription.user_id);

    const allowed = VALID_TRANSITIONS[subscription.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw new BadRequestError(
        `${subscription.status} → ${toStatus} 상태 전이는 허용되지 않습니다.`,
      );
    }

    logger.info({
      action: 'subscription.status.changed',
      userId: requestingUserId,
      subscriptionId: id,
      from: subscription.status,
      to: toStatus,
    });

    return this.subscriptionRepo.updateStatus(id, subscription.status as SubscriptionStatus, toStatus as SubscriptionStatus, requestingUserId);
  }

  async getCancelGuide(id: string, requestingUserId: string) {
    const subscription = await this.subscriptionRepo.findById(id);
    if (!subscription) throw new NotFoundError('해당 구독을 찾을 수 없습니다.');
    assertOwnership(requestingUserId, subscription.user_id);
    // ⚠️ 해지 안내만 제공 — 자동 해지 실행 금지 (CLAUDE.md §8)
    return this.subscriptionRepo.findCancelGuide(subscription.catalog_id);
  }
}
