import type { NextFunction, Request, Response } from 'express';

import { successResponse } from '@subtrack/shared';
import { CardService } from '../services/card.service.js';

export class CardController {
  private readonly cardService = new CardService();

  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.cardService.list(req.user!.userId);
      res.json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async link(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.cardService.link(req.user!.userId, req.body);
      res.status(201).json(successResponse(result));
    } catch (err) {
      next(err);
    }
  }

  async unlink(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await this.cardService.unlink(req.params['id']!, req.user!.userId);
      res.json(successResponse(null));
    } catch (err) {
      next(err);
    }
  }
}
