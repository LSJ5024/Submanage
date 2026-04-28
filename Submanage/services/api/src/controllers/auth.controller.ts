import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { BadRequestError } from '../common/errors.js';
import { AuthService } from '../services/auth.service.js';
import { successResponse } from '@subtrack/shared';

const registerSchema = z.object({
  email: z.string().email('유효한 이메일 주소를 입력하세요.'),
  password: z.string().min(8, '비밀번호는 8자 이상이어야 합니다.'),
  name: z.string().min(1, '이름을 입력하세요.'),
  phoneNumber: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export class AuthController {
  private readonly authService = new AuthService();

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = registerSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? '입력값 오류');

      const result = await this.authService.register(parsed.data);
      res.status(201).json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = loginSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? '입력값 오류');

      const result = await this.authService.login(parsed.data);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as { refreshToken?: string };
      if (!refreshToken) throw new BadRequestError('refreshToken이 필요합니다.');

      const result = await this.authService.refresh(refreshToken);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }
}
