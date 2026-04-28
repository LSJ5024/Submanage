import { SubscriptionRepository } from '../repositories/subscription.repository.js';

export class DashboardService {
  private readonly subscriptionRepo = new SubscriptionRepository();

  /** 대시보드 집계 데이터 (TASK-025, FR-002) */
  async getDashboard(userId: string) {
    const [totalAmount, upcomingBillings, categoryBreakdown] = await Promise.all([
      this.subscriptionRepo.getMonthlyTotal(userId),
      this.subscriptionRepo.getUpcomingBillings(userId, 7), // D-7 이내
      this.subscriptionRepo.getCategoryBreakdown(userId),
    ]);

    return {
      totalMonthlyAmount: Number(totalAmount),
      upcomingBillings: upcomingBillings.map((s) => ({
        id: s.id,
        serviceName: s.service_name,
        amount: Number(s.amount),
        nextBillingDate: s.next_billing_date,
        daysLeft: Math.ceil((s.next_billing_date.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
      })),
      categoryBreakdown: categoryBreakdown.map((c) => ({
        category: c.category,
        total: Number(c._sum.amount ?? 0),
        count: c._count.id,
      })),
    };
  }

  /** 월별 지출 리포트 (TASK-025, FR-006) */
  async getMonthlyReport(userId: string, year: number, month: number) {
    const subscriptions = await this.subscriptionRepo.getMonthlyReport(userId, year, month);

    const totalAmount = subscriptions.reduce((sum, s) => sum + Number(s.amount), 0);

    const categoryBreakdown = subscriptions.reduce<Record<string, number>>((acc, s) => {
      acc[s.category] = (acc[s.category] ?? 0) + Number(s.amount);
      return acc;
    }, {});

    return {
      year,
      month,
      totalAmount,
      subscriptionCount: subscriptions.length,
      categoryBreakdown,
      subscriptions: subscriptions.map((s) => ({
        id: s.id,
        serviceName: s.service_name,
        amount: Number(s.amount),
        category: s.category,
        billingCycle: s.billing_cycle,
        status: s.status,
      })),
    };
  }

  /** 구독 목록 (정렬 지원, TASK-025) */
  async getSubscriptions(userId: string, sort?: string) {
    return this.subscriptionRepo.findManyByUser({ userId, limit: 100, sort });
  }
}
