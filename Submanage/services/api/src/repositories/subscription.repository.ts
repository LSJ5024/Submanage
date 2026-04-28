import type { SubscriptionStatus } from '@subtrack/shared';
import { prisma } from '../lib/prisma.js';

interface ListParams {
  userId: string;
  cursor?: string;
  limit: number;
  sort?: string;
}

export class SubscriptionRepository {
  async findManyByUser({ userId, cursor, limit, sort }: ListParams) {
    const orderBy = this.resolveOrderBy(sort);
    const items = await prisma.subscription.findMany({
      where: { user_id: userId, deleted_at: null },
      orderBy,
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = items.length > limit;
    const result = hasMore ? items.slice(0, limit) : items;
    return {
      items: result,
      nextCursor: hasMore ? (result[result.length - 1]?.id ?? null) : null,
      hasMore,
    };
  }

  async findById(id: string) {
    return prisma.subscription.findFirst({ where: { id, deleted_at: null } });
  }

  async create(data: Record<string, unknown>) {
    return prisma.subscription.create({ data: data as Parameters<typeof prisma.subscription.create>[0]['data'] });
  }

  async update(id: string, data: Record<string, unknown>) {
    return prisma.subscription.update({ where: { id }, data: data as Parameters<typeof prisma.subscription.update>[0]['data'] });
  }

  // 소프트 삭제 (CLAUDE.md §6 — DELETE 쿼리 직접 실행 금지)
  async softDelete(id: string, changedBy: string) {
    return prisma.$transaction([
      prisma.subscription.update({ where: { id }, data: { deleted_at: new Date() } }),
      prisma.subscriptionStatusHistory.create({
        data: { subscription_id: id, from_status: 'ACTIVE', to_status: 'CANCELLED', changed_by: changedBy },
      }),
    ]);
  }

  async updateStatus(id: string, fromStatus: SubscriptionStatus, toStatus: SubscriptionStatus, changedBy: string) {
    return prisma.$transaction([
      prisma.subscription.update({ where: { id }, data: { status: toStatus } }),
      prisma.subscriptionStatusHistory.create({
        data: { subscription_id: id, from_status: fromStatus, to_status: toStatus, changed_by: changedBy },
      }),
    ]);
  }

  async findCancelGuide(catalogId: string | null) {
    if (!catalogId) return null;
    return prisma.cancellationGuide.findFirst({ where: { catalog_id: catalogId } });
  }

  async getMonthlyTotal(userId: string) {
    const result = await prisma.subscription.aggregate({
      where: { user_id: userId, status: 'ACTIVE', deleted_at: null },
      _sum: { amount: true },
    });
    return result._sum.amount ?? 0;
  }

  async getUpcomingBillings(userId: string, withinDays: number) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + withinDays);
    return prisma.subscription.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        status: 'ACTIVE',
        next_billing_date: { lte: cutoff },
      },
      orderBy: { next_billing_date: 'asc' },
    });
  }

  async getCategoryBreakdown(userId: string) {
    return prisma.subscription.groupBy({
      by: ['category'],
      where: { user_id: userId, status: 'ACTIVE', deleted_at: null },
      _sum: { amount: true },
      _count: { id: true },
    });
  }

  async getMonthlyReport(userId: string, year: number, month: number) {
    // 해당 월의 활성 구독 기준 리포트
    return prisma.subscription.findMany({
      where: {
        user_id: userId,
        deleted_at: null,
        status: { in: ['ACTIVE', 'CANCELLED'] },
      },
      orderBy: { amount: 'desc' },
    });
  }

  private resolveOrderBy(sort?: string): Record<string, 'asc' | 'desc'> {
    switch (sort) {
      case 'amount': return { amount: 'desc' };
      case 'billing_date': return { next_billing_date: 'asc' };
      case 'category': return { category: 'asc' };
      default: return { next_billing_date: 'asc' };
    }
  }
}
