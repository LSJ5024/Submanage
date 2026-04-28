import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { successResponse } from '@subtrack/shared';
import { BadRequestError } from '../common/errors.js';
import { AdminService } from '../services/admin.service.js';

const guideSchema = z.object({
  catalogId:      z.string().uuid(),
  steps:          z.array(z.object({ order: z.number(), description: z.string(), imageUrl: z.string().optional() })),
  deepLink:       z.string().url().optional(),
  screenshotUrls: z.array(z.string().url()).optional(),
});

/**
 * AdminController — 해지 가이드 CMS (TASK-024)
 * 입력값 유효성 검증만 담당. 비즈니스 로직은 AdminService로 위임 (CLAUDE.md §4).
 * ⚠️ requireAdmin 미들웨어 통과 후 진입 보장됨.
 */
export class AdminController {
  private readonly adminService = new AdminService();

  async createGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = guideSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? '입력값 오류');

      const guide = await this.adminService.createGuide(parsed.data);
      res.status(201).json(successResponse(guide));
    } catch (err) {
      next(err);
    }
  }

  async updateGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const updateSchema = guideSchema.partial().omit({ catalogId: true });
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? '입력값 오류');

      const guide = await this.adminService.updateGuide(req.params['id']!, parsed.data);
      res.json(successResponse(guide));
    } catch (err) {
      next(err);
    }
  }

  async listGuides(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const guides = await this.adminService.listGuides();
      res.json(successResponse(guides));
    } catch (err) {
      next(err);
    }
  }
}
