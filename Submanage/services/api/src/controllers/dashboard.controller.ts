import type { NextFunction, Request, Response } from 'express';

import { successResponse } from '@subtrack/shared';
import { DashboardService } from '../services/dashboard.service.js';

export class DashboardController {
  private readonly dashboardService = new DashboardService();

  async getDashboard(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.dashboardService.getDashboard(req.user!.userId);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async getMonthlyReport(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const year = Number(req.query['year'] ?? new Date().getFullYear());
      const month = Number(req.query['month'] ?? new Date().getMonth() + 1);
      const result = await this.dashboardService.getMonthlyReport(req.user!.userId, year, month);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async getSubscriptions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const sort = req.query['sort'] as string | undefined;
      const result = await this.dashboardService.getSubscriptions(req.user!.userId, sort);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }
}
