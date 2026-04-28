import { prisma } from '../lib/prisma.js';

interface CreateUserData {
  email: string;
  password: string;
  name: string;
  phone_number?: string;
}

export class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findFirst({ where: { email, deleted_at: null } });
  }

  async findById(id: string) {
    return prisma.user.findFirst({ where: { id, deleted_at: null } });
  }

  async create(data: CreateUserData) {
    return prisma.user.create({ data });
  }

  // 소프트 삭제 — DELETE 직접 실행 금지 (CLAUDE.md §6)
  async softDelete(id: string) {
    return prisma.user.update({ where: { id }, data: { deleted_at: new Date() } });
  }
}
