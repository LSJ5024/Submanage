import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

import { UnauthorizedError, ForbiddenError } from '../common/errors.js';

export interface JwtPayload {
  userId: string;
  email: string;
  role: 'USER' | 'ADMIN';
  iat: number;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Bearer 토큰이 필요합니다.');
  }

  const token = authHeader.slice(7);
  const secret = process.env.JWT_ACCESS_SECRET;
  if (!secret) throw new Error('JWT_ACCESS_SECRET 환경변수가 설정되지 않았습니다.');

  try {
    const payload = jwt.verify(token, secret) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    throw new UnauthorizedError('유효하지 않거나 만료된 토큰입니다.');
  }
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new UnauthorizedError();
  if (req.user.role !== 'ADMIN') throw new ForbiddenError('관리자 권한이 필요합니다.');
  next();
}

/** 사용자가 본인 데이터에만 접근하도록 소유권 검증 (CLAUDE.md §7) */
export function assertOwnership(userId: string, resourceOwnerId: string): void {
  if (userId !== resourceOwnerId) {
    throw new ForbiddenError('본인의 데이터에만 접근할 수 있습니다.');
  }
}
