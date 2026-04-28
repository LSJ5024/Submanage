import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import { ConflictError, UnauthorizedError } from '../common/errors.js';
import { UserRepository } from '../repositories/user.repository.js';
import { logger } from '../middlewares/logger.js';

const SALT_ROUNDS = 12; // CLAUDE.md §7 — 12 이상 고정

interface RegisterInput {
  email: string;
  password: string;
  name: string;
  phoneNumber?: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private readonly userRepo = new UserRepository();

  async register(input: RegisterInput): Promise<{ userId: string; email: string }> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) throw new ConflictError('이미 사용 중인 이메일입니다.');

    const hashedPassword = await bcrypt.hash(input.password, SALT_ROUNDS);

    // ⚠️ 비밀번호 평문/해시 모두 로그 출력 절대 금지 (CLAUDE.md §7)
    const user = await this.userRepo.create({
      email: input.email,
      password: hashedPassword,
      name: input.name,
      phone_number: input.phoneNumber,
    });

    logger.info({ action: 'auth.register', userId: user.id });
    return { userId: user.id, email: user.email };
  }

  async login(input: LoginInput): Promise<TokenPair> {
    const user = await this.userRepo.findByEmail(input.email);
    if (!user) throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다.');

    const isValid = await bcrypt.compare(input.password, user.password);
    if (!isValid) throw new UnauthorizedError('이메일 또는 비밀번호가 올바르지 않습니다.');

    logger.info({ action: 'auth.login', userId: user.id });
    return this.issueTokens(user.id, user.email);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    const secret = process.env.JWT_REFRESH_SECRET;
    if (!secret) throw new Error('JWT_REFRESH_SECRET 환경변수가 설정되지 않았습니다.');

    try {
      const payload = jwt.verify(refreshToken, secret) as { userId: string; email: string };
      return this.issueTokens(payload.userId, payload.email);
    } catch {
      throw new UnauthorizedError('유효하지 않거나 만료된 리프레시 토큰입니다.');
    }
  }

  private issueTokens(userId: string, email: string): TokenPair {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!accessSecret || !refreshSecret) throw new Error('JWT 시크릿 환경변수가 설정되지 않았습니다.');

    const accessToken = jwt.sign(
      { userId, email, role: 'USER' },
      accessSecret,
      { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? '1h', algorithm: 'HS256' },
    );
    const refreshToken = jwt.sign(
      { userId, email },
      refreshSecret,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d', algorithm: 'HS256' },
    );

    return { accessToken, refreshToken };
  }
}
