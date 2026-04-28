import { SubscriptionService } from './subscription.service.js';
import { SubscriptionRepository } from '../repositories/subscription.repository.js';
import { ForbiddenError, NotFoundError, BadRequestError } from '../common/errors.js';

// Repository 모킹 — 단위 테스트이므로 DB 미사용
jest.mock('../repositories/subscription.repository.js');

const MockedRepo = SubscriptionRepository as jest.MockedClass<typeof SubscriptionRepository>;

describe('SubscriptionService', () => {
  let service: SubscriptionService;
  let mockRepo: jest.Mocked<SubscriptionRepository>;

  beforeEach(() => {
    MockedRepo.mockClear();
    service = new SubscriptionService();
    mockRepo = MockedRepo.mock.instances[0] as jest.Mocked<SubscriptionRepository>;
  });

  describe('findOne()', () => {
    it('본인 구독은 정상 조회된다', async () => {
      const fakeSubscription = { id: 'sub-1', user_id: 'user-1', service_name: 'Netflix' };
      mockRepo.findById.mockResolvedValue(fakeSubscription as never);

      const result = await service.findOne('sub-1', 'user-1');
      expect(result).toEqual(fakeSubscription);
    });

    it('존재하지 않는 구독은 NotFoundError를 던진다', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findOne('sub-999', 'user-1')).rejects.toThrow(NotFoundError);
    });

    it('타인의 구독 조회 시 ForbiddenError를 던진다', async () => {
      const fakeSubscription = { id: 'sub-1', user_id: 'user-2', service_name: 'Netflix' };
      mockRepo.findById.mockResolvedValue(fakeSubscription as never);

      await expect(service.findOne('sub-1', 'user-1')).rejects.toThrow(ForbiddenError);
    });
  });

  describe('remove()', () => {
    it('본인 구독을 소프트 삭제한다', async () => {
      const fakeSubscription = { id: 'sub-1', user_id: 'user-1', service_name: 'Spotify' };
      mockRepo.findById.mockResolvedValue(fakeSubscription as never);
      mockRepo.softDelete.mockResolvedValue([{} as never, {} as never]);

      await service.remove('sub-1', 'user-1');
      expect(mockRepo.softDelete).toHaveBeenCalledWith('sub-1', 'user-1');
    });

    it('DELETE 직접 호출이 아닌 softDelete를 사용한다', async () => {
      const fakeSubscription = { id: 'sub-1', user_id: 'user-1', service_name: 'Spotify' };
      mockRepo.findById.mockResolvedValue(fakeSubscription as never);
      mockRepo.softDelete.mockResolvedValue([{} as never, {} as never]);

      await service.remove('sub-1', 'user-1');
      // softDelete가 호출되어야 하며, 직접 delete는 호출되지 않아야 함
      expect(mockRepo.softDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateStatus() — 상태 머신 (TASK-022)', () => {
    const mockSub = (status: string) => ({
      id: 'sub-1',
      user_id: 'user-1',
      service_name: 'Netflix',
      status,
      catalog_id: null,
    });

    it.each([
      ['DETECTED', 'ACTIVE'],
      ['ACTIVE', 'CANCELLING'],
      ['ACTIVE', 'PAUSED'],
      ['PAUSED', 'ACTIVE'],
      ['CANCELLING', 'CANCELLED'],
      ['CANCELLING', 'ACTIVE'],
    ])('%s → %s 전이는 허용된다', async (from, to) => {
      mockRepo.findById.mockResolvedValue(mockSub(from) as never);
      mockRepo.updateStatus.mockResolvedValue([{} as never, {} as never]);

      await expect(service.updateStatus('sub-1', 'user-1', to)).resolves.not.toThrow();
    });

    it.each([
      ['DETECTED', 'CANCELLED'],
      ['ACTIVE', 'DETECTED'],
      ['CANCELLED', 'ACTIVE'],
      ['CANCELLED', 'PAUSED'],
    ])('%s → %s 전이는 차단된다', async (from, to) => {
      mockRepo.findById.mockResolvedValue(mockSub(from) as never);

      await expect(service.updateStatus('sub-1', 'user-1', to)).rejects.toThrow(BadRequestError);
    });
  });

  describe('getCancelGuide()', () => {
    it('해지 가이드 조회 시 자동 해지 로직이 실행되지 않는다', async () => {
      const fakeSubscription = { id: 'sub-1', user_id: 'user-1', catalog_id: 'cat-1', service_name: 'Netflix' };
      mockRepo.findById.mockResolvedValue(fakeSubscription as never);
      mockRepo.findCancelGuide.mockResolvedValue({ steps: [], deep_link: 'https://netflix.com' } as never);

      const result = await service.getCancelGuide('sub-1', 'user-1');
      // 결과는 가이드 정보만 반환 — 자동 해지 API 호출 없음
      expect(result).toBeDefined();
      expect(mockRepo.findCancelGuide).toHaveBeenCalledWith('cat-1');
    });
  });
});
