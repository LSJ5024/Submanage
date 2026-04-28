import { prisma } from '../lib/prisma.js';

export class CardRepository {
  async findByUserId(userId: string) {
    return prisma.card.findMany({ where: { user_id: userId, is_active: true } });
  }

  async findById(id: string) {
    return prisma.card.findFirst({ where: { id, is_active: true } });
  }

  async create(data: { userId: string; cardCompany: string }) {
    return prisma.card.create({
      data: {
        user_id: data.userId,
        card_company: data.cardCompany as Parameters<typeof prisma.card.create>[0]['data']['card_company'],
        last_four_digits: '****', // 실제 값은 마이데이터 API에서 수신
      },
    });
  }

  // 소프트 삭제 — is_active = false (CLAUDE.md §6)
  async softDelete(id: string) {
    return prisma.card.update({ where: { id }, data: { is_active: false } });
  }
}
