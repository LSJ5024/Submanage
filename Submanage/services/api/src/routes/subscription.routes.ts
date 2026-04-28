import { Router } from 'express';

import { SubscriptionController } from '../controllers/subscription.controller.js';
import { authenticate } from '../middlewares/auth.js';

export const subscriptionRouter = Router();
const ctrl = new SubscriptionController();

subscriptionRouter.use(authenticate);

subscriptionRouter.get('/', (req, res, next) => ctrl.list(req, res, next));
subscriptionRouter.post('/', (req, res, next) => ctrl.create(req, res, next));
subscriptionRouter.get('/:id', (req, res, next) => ctrl.findOne(req, res, next));
subscriptionRouter.patch('/:id', (req, res, next) => ctrl.update(req, res, next));
subscriptionRouter.delete('/:id', (req, res, next) => ctrl.remove(req, res, next));
subscriptionRouter.patch('/:id/status', (req, res, next) => ctrl.updateStatus(req, res, next));
subscriptionRouter.get('/:id/cancel-guide', (req, res, next) => ctrl.getCancelGuide(req, res, next));
