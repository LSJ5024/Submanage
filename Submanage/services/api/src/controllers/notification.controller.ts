import type { NextFunction, Request, Response } from 'express';

import { successResponse } from '@subtrack/shared';
import { NotificationService } from '../services/notification.service.js';

export class NotificationController {
  private readonly notificationService = new NotificationService();

  async getSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.notificationService.getSettings(req.user!.userId);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.notificationService.updateSettings(req.user!.userId, req.body);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }
}
