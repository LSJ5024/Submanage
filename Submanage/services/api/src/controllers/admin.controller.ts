import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

import { successResponse } from '@subtrack/shared';
import { BadRequestError } from '../common/errors.js';
import { prisma } from '../lib/prisma.js';

const guideSchema = z.object({
  catalogId: z.string().uuid(),
  steps: z.array(
    z.object({ order: z.number(), description: z.string(), imageUrl: z.string().optional() }),
  ),
  deepLink: z.string().url().optional(),
  screenshotUrls: z.array(z.string().url()).optional(),
});

/**
 * AdminController — 해지 가이드 CMS (TASK-024)
 * 개발 배포 없이 콘텐츠 업데이트 가능.
 * ⚠️ requireAdmin 미들웨어 통과 후 진입 보장됨.
 */
export class AdminController {
  async createGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const parsed = guideSchema.safeParse(req.body);
      if (!parsed.success) throw new BadRequestError(parsed.error.errors[0]?.message ?? '입력값 오류');

      const guide = await prisma.cancellationGuide.create({
        data: {
          catalog_id: parsed.data.catalogId,
          steps: parsed.data.steps,
          deep_link: parsed.data.deepLink ?? null,
          screenshot_urls: parsed.data.screenshotUrls ?? [],
        },
      });

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

      const guide = await prisma.cancellationGuide.update({
        where: { id: req.params['id'] },
        data: {
          ...(parsed.data.steps ? { steps: parsed.data.steps } : {}),
          ...(parsed.data.deepLink !== undefined ? { deep_link: parsed.data.deepLink } : {}),
          ...(parsed.data.screenshotUrls ? { screenshot_urls: parsed.data.screenshotUrls } : {}),
        },
      });

      res.json(successResponse(guide));
    } catch (err) {
      next(err);
    }
  }

  async listGuides(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const guides = await prisma.cancellationGuide.findMany({
        include: { catalog: { select: { service_name: true, category: true } } },
        orderBy: { updated_at: 'desc' },
      });
      res.json(successResponse(guides));
    } catch (err) {
      next(err);
    }
  }
}
