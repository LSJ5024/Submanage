import { AuthService } from './auth.service.js';
import { UserRepository } from '../repositories/user.repository.js';
import { ConflictError, UnauthorizedError } from '../common/errors.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

jest.mock('../repositories/user.repository.js');
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

const MockedRepo = UserRepository as jest.MockedClass<typeof UserRepository>;
const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;
const mockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('AuthService', () => {
  let service: AuthService;
  let mockRepo: jest.Mocked<UserRepository>;

  beforeEach(() => {
    MockedRepo.mockClear();
    service = new AuthService();
    mockRepo = MockedRepo.mock.instances[0] as jest.Mocked<UserRepository>;

    process.env.JWT_ACCESS_SECRET = 'test_access_secret_32chars_minimum_len';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32chars_minimum';
  });

  // ── register ───────────────────────────────────────────────
  describe('register()', () => {
    it('신규 사용자를 등록하고 userId와 email을 반환한다', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
      mockRepo.create.mockResolvedValue({ id: 'user-1', email: 'test@test.com' } as never);

      const result = await service.register({
        email: 'test@test.com',
        password: 'password123',
        name: '홍길동',
      });

      expect(result).toEqual({ userId: 'user-1', email: 'test@test.com' });
    });

    it('이미 존재하는 이메일이면 ConflictError를 던진다', async () => {
      mockRepo.findByEmail.mockResolvedValue({ id: 'user-1' } as never);

      await expect(
        service.register({ email: 'dup@test.com', password: 'pw', name: '중복' }),
      ).rejects.toThrow(ConflictError);
    });

    it('bcrypt salt rounds가 12 이상이다 (CLAUDE.md §7)', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockRepo.create.mockResolvedValue({ id: 'u1', email: 'e@e.com' } as never);

      await service.register({ email: 'e@e.com', password: 'pw12345678', name: '테스트' });

      // bcrypt.hash 첫 번째 호출의 두 번째 인자(saltRounds)가 12 이상인지 확인
      const saltRounds = (mockedBcrypt.hash as jest.Mock).mock.calls[0][1] as number;
      expect(saltRounds).toBeGreaterThanOrEqual(12);
    });

    it('등록 후 로그에 비밀번호가 포함되지 않는다 (CLAUDE.md §7)', async () => {
      const logSpy = jest.spyOn(console, 'log');
      mockRepo.findByEmail.mockResolvedValue(null);
      (mockedBcrypt.hash as jest.Mock).mockResolvedValue('hashed');
      mockRepo.create.mockResolvedValue({ id: 'u1', email: 'e@e.com' } as never);

      await service.register({ email: 'e@e.com', password: 'secret_password', name: '테스트' });

      const allLogs = logSpy.mock.calls.flat().join(' ');
      expect(allLogs).not.toContain('secret_password');
      expect(allLogs).not.toContain('hashed');
      logSpy.mockRestore();
    });
  });

  // ── login ──────────────────────────────────────────────────
  describe('login()', () => {
    it('올바른 자격증명으로 로그인하면 accessToken과 refreshToken을 반환한다', async () => {
      mockRepo.findByEmail.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        password: 'hashed',
      } as never);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(true);
      (mockedJwt.sign as jest.Mock).mockReturnValue('mock_token');

      const result = await service.login({ email: 'test@test.com', password: 'correct' });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('존재하지 않는 이메일이면 UnauthorizedError를 던진다', async () => {
      mockRepo.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'none@test.com', password: 'pw' }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('비밀번호가 틀리면 UnauthorizedError를 던진다', async () => {
      mockRepo.findByEmail.mockResolvedValue({ id: 'u1', password: 'hashed' } as never);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'test@test.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedError);
    });

    it('로그인 실패 시 이메일/비밀번호 중 어느 것이 틀렸는지 구분하지 않는다 (보안)', async () => {
      // 이메일 없음
      mockRepo.findByEmail.mockResolvedValue(null);
      let err1: Error | null = null;
      try { await service.login({ email: 'x@x.com', password: 'pw' }); } catch (e) { err1 = e as Error; }

      // 비밀번호 틀림
      mockRepo.findByEmail.mockResolvedValue({ id: 'u1', password: 'hashed' } as never);
      (mockedBcrypt.compare as jest.Mock).mockResolvedValue(false);
      let err2: Error | null = null;
      try { await service.login({ email: 'x@x.com', password: 'pw' }); } catch (e) { err2 = e as Error; }

      expect(err1?.message).toBe(err2?.message);
    });
  });

  // ── refresh ────────────────────────────────────────────────
  describe('refresh()', () => {
    it('유효한 refresh token으로 새 token pair를 발급한다', async () => {
      (mockedJwt.verify as jest.Mock).mockReturnValue({ userId: 'u1', email: 'e@e.com' });
      (mockedJwt.sign as jest.Mock).mockReturnValue('new_token');

      const result = await service.refresh('valid_refresh_token');

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('만료된 refresh token이면 UnauthorizedError를 던진다', async () => {
      (mockedJwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refresh('expired_token')).rejects.toThrow(UnauthorizedError);
    });
  });
});
