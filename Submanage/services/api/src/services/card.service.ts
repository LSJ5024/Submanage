import { BadRequestError, NotFoundError } from '../common/errors.js';
import { assertOwnership } from '../middlewares/auth.js';
import { CardRepository } from '../repositories/card.repository.js';
import { MyDataConnector } from './mydata/mydata.connector.js';
import { TransactionSyncService } from './transaction-sync.service.js';
import { logger } from '../middlewares/logger.js';

// 국내 7대 카드사 화이트리스트 (CLAUDE.md §8 — 해외 카드사 연동 금지)
const SUPPORTED_CARD_COMPANIES = ['SHINHAN', 'KB', 'HYUNDAI', 'SAMSUNG', 'LOTTE', 'WOORI', 'HANA'];

export class CardService {
  private readonly cardRepo = new CardRepository();
  private readonly mydata = new MyDataConnector();
  private readonly syncService = new TransactionSyncService();

  async list(userId: string) {
    return this.cardRepo.findByUserId(userId);
  }

  async link(userId: string, data: { cardCompany: string; authCode: string }) {
    if (!SUPPORTED_CARD_COMPANIES.includes(data.cardCompany)) {
      throw new BadRequestError(
        `지원하지 않는 카드사입니다. 지원 카드사: ${SUPPORTED_CARD_COMPANIES.join(', ')}`,
      );
    }

    // 마이데이터 OAuth 인가 코드로 토큰 발급 및 Redis 저장
    await this.mydata.authorize(userId, data.authCode);

    const card = await this.cardRepo.create({ userId, cardCompany: data.cardCompany });

    // 최초 연동 시 12개월치 결제 내역 비동기 동기화 (응답은 즉시 반환)
    this.syncService.syncInitial(userId, card.id).catch((err: Error) => {
      logger.error({ action: 'card.link.sync.error', userId, message: err.message });
    });

    return card;
  }

  async unlink(cardId: string, requestingUserId: string): Promise<void> {
    const card = await this.cardRepo.findById(cardId);
    if (!card) throw new NotFoundError('해당 카드를 찾을 수 없습니다.');
    assertOwnership(requestingUserId, card.user_id);
    await this.cardRepo.softDelete(cardId);
  }
}
