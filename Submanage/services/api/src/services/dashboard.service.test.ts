import { DashboardService } from './dashboard.service.js';
import { SubscriptionRepository } from '../repositories/subscription.repository.js';

jest.mock('../repositories/subscription.repository.js');

const MockedRepo = SubscriptionRepository as jest.MockedClass<typeof SubscriptionRepository>;

describe('DashboardService', () => {
  let service: DashboardService;
  let mockRepo: jest.Mocked<SubscriptionRepository>;

  beforeEach(() => {
    MockedRepo.mockClear();
    service  = new DashboardService();
    mockRepo = MockedRepo.mock.instances[0] as jest.Mocked<SubscriptionRepository>;
  });

  // ── getDashboard ───────────────────────────────────────────────────────────
  describe('getDashboard()', () => {
    const mockUpcoming = [
      {
        id: 'sub-1', service_name: 'Netflix', amount: 17000,
        next_billing_date: new Date(Date.now() + 2 * 86400000), // D-2
      },
      {
        id: 'sub-2', service_name: 'Spotify', amount: 10900,
        next_billing_date: new Date(Date.now() + 5 * 86400000), // D-5
      },
    ];

    const mockCategory = [
      { category: 'VIDEO',    _sum: { amount: 34000 }, _count: { id: 2 } },
      { category: 'MUSIC',    _sum: { amount: 10900 }, _count: { id: 1 } },
      { category: 'SOFTWARE', _sum: { amount: 28600 }, _count: { id: 1 } },
    ];

    beforeEach(() => {
      mockRepo.getMonthlyTotal.mockResolvedValue(73500 as never);
      mockRepo.getUpcomingBillings.mockResolvedValue(mockUpcoming as never);
      mockRepo.getCategoryBreakdown.mockResolvedValue(mockCategory as never);
    });

    it('총액, 임박 결제, 카테고리 분포를 반환한다', async () => {
      const result = await service.getDashboard('user-1');

      expect(result.totalMonthlyAmount).toBe(73500);
      expect(result.upcomingBillings).toHaveLength(2);
      expect(result.categoryBreakdown).toHaveLength(3);
    });

    it('임박 결제에 daysLeft 필드가 포함된다', async () => {
      const result = await service.getDashboard('user-1');

      const netflix = result.upcomingBillings.find((b) => b.serviceName === 'Netflix');
      expect(netflix).toBeDefined();
      expect(netflix!.daysLeft).toBeGreaterThanOrEqual(1);
      expect(netflix!.daysLeft).toBeLessThanOrEqual(3);
      expect(netflix!.amount).toBe(17000);
    });

    it('카테고리 분포가 올바르게 매핑된다', async () => {
      const result = await service.getDashboard('user-1');

      const video = result.categoryBreakdown.find((c) => c.category === 'VIDEO');
      expect(video).toEqual({ category: 'VIDEO', total: 34000, count: 2 });
    });

    it('3개 API를 병렬로 호출한다', async () => {
      await service.getDashboard('user-1');

      // 모두 한 번씩 호출
      expect(mockRepo.getMonthlyTotal).toHaveBeenCalledWith('user-1');
      expect(mockRepo.getUpcomingBillings).toHaveBeenCalledWith('user-1', 7);
      expect(mockRepo.getCategoryBreakdown).toHaveBeenCalledWith('user-1');
    });

    it('구독이 없으면 totalMonthlyAmount가 0이다', async () => {
      mockRepo.getMonthlyTotal.mockResolvedValue(0 as never);
      mockRepo.getUpcomingBillings.mockResolvedValue([] as never);
      mockRepo.getCategoryBreakdown.mockResolvedValue([] as never);

      const result = await service.getDashboard('user-empty');

      expect(result.totalMonthlyAmount).toBe(0);
      expect(result.upcomingBillings).toHaveLength(0);
      expect(result.categoryBreakdown).toHaveLength(0);
    });
  });

  // ── getMonthlyReport ────────────────────────────────────────────────────────
  describe('getMonthlyReport()', () => {
    const mockSubs = [
      { id: 'sub-1', service_name: 'Netflix',  amount: 17000, category: 'VIDEO',    billing_cycle: 'MONTHLY', status: 'ACTIVE' },
      { id: 'sub-2', service_name: 'Spotify',  amount: 10900, category: 'MUSIC',    billing_cycle: 'MONTHLY', status: 'ACTIVE' },
      { id: 'sub-3', service_name: 'Adobe CC', amount: 28600, category: 'SOFTWARE', billing_cycle: 'MONTHLY', status: 'ACTIVE' },
    ];

    beforeEach(() => {
      mockRepo.getMonthlyReport.mockResolvedValue(mockSubs as never);
    });

    it('해당 월의 총 지출과 구독 수를 반환한다', async () => {
      const result = await service.getMonthlyReport('user-1', 2026, 4);

      expect(result.year).toBe(2026);
      expect(result.month).toBe(4);
      expect(result.totalAmount).toBe(56500); // 17000 + 10900 + 28600
      expect(result.subscriptionCount).toBe(3);
    });

    it('카테고리별 지출 합계가 올바르다', async () => {
      const result = await service.getMonthlyReport('user-1', 2026, 4);

      expect(result.categoryBreakdown['VIDEO']).toBe(17000);
      expect(result.categoryBreakdown['MUSIC']).toBe(10900);
      expect(result.categoryBreakdown['SOFTWARE']).toBe(28600);
    });

    it('구독 목록이 반환된다', async () => {
      const result = await service.getMonthlyReport('user-1', 2026, 4);

      expect(result.subscriptions).toHaveLength(3);
      expect(result.subscriptions[0]).toMatchObject({
        serviceName: 'Netflix',
        amount: 17000,
        category: 'VIDEO',
      });
    });

    it('구독이 없는 달은 totalAmount가 0이다', async () => {
      mockRepo.getMonthlyReport.mockResolvedValue([] as never);

      const result = await service.getMonthlyReport('user-1', 2020, 1);

      expect(result.totalAmount).toBe(0);
      expect(result.subscriptionCount).toBe(0);
      expect(result.categoryBreakdown).toEqual({});
    });
  });

  // ── getSubscriptions ────────────────────────────────────────────────────────
  describe('getSubscriptions()', () => {
    it('구독 목록을 정렬 파라미터와 함께 조회한다', async () => {
      mockRepo.findManyByUser.mockResolvedValue({
        items: [], nextCursor: null, hasMore: false,
      } as never);

      await service.getSubscriptions('user-1', 'amount');

      expect(mockRepo.findManyByUser).toHaveBeenCalledWith({
        userId: 'user-1',
        limit:  100,
        sort:   'amount',
      });
    });

    it('sort 미지정 시 기본값으로 조회한다', async () => {
      mockRepo.findManyByUser.mockResolvedValue({
        items: [], nextCursor: null, hasMore: false,
      } as never);

      await service.getSubscriptions('user-1');

      expect(mockRepo.findManyByUser).toHaveBeenCalledWith({
        userId: 'user-1',
        limit:  100,
        sort:   undefined,
      });
    });
  });
});
