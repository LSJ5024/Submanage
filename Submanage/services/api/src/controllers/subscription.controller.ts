import type { NextFunction, Request, Response } from 'express';

import { successResponse } from '@subtrack/shared';
import { SubscriptionService } from '../services/subscription.service.js';

export class SubscriptionController {
  private readonly subscriptionService = new SubscriptionService();

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const cursor = req.query['cursor'] as string | undefined;
      const limit = Math.min(Number(req.query['limit'] ?? 20), 100);
      const sort = req.query['sort'] as string | undefined;

      const result = await this.subscriptionService.list({ userId, cursor, limit, sort });
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const result = await this.subscriptionService.create({ userId, ...req.body });
      res.status(201).json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async findOne(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.subscriptionService.findOne(req.params['id']!, req.user!.userId);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.subscriptionService.update(req.params['id']!, req.user!.userId, req.body);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.subscriptionService.remove(req.params['id']!, req.user!.userId);
      res.json(successResponse(null));
    } catch (err) {
      next(err);
    }
  }

  async updateStatus(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { status } = req.body as { status: string };
      const result = await this.subscriptionService.updateStatus(
        req.params['id']!,
        req.user!.userId,
        status,
      );
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async getCancelGuide(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.subscriptionService.getCancelGuide(
        req.params['id']!,
        req.user!.userId,
      );
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }
}
