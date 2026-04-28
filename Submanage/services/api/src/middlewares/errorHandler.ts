import type { NextFunction, Request, Response } from 'express';

import { AppError } from '../common/errors.js';
import { logger } from './logger.js';
import { errorResponse } from '@subtrack/shared';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const requestId = req.headers['x-request-id'] as string;

  if (err instanceof AppError) {
    logger.warn({ requestId, code: err.code, statusCode: err.statusCode, message: err.message });
    res.status(err.statusCode).json(errorResponse(err.code, err.message));
    return;
  }

  logger.error({ requestId, error: err.message, stack: err.stack });
  res.status(500).json(errorResponse('INTERNAL_SERVER_ERROR', '서버 내부 오류가 발생했습니다.'));
}
