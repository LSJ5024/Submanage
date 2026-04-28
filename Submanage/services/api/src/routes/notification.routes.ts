import { Router } from 'express';

import { NotificationController } from '../controllers/notification.controller.js';
import { authenticate } from '../middlewares/auth.js';

export const notificationRouter = Router();
const ctrl = new NotificationController();

notificationRouter.use(authenticate);

notificationRouter.get('/settings', (req, res, next) => ctrl.getSettings(req, res, next));
notificationRouter.patch('/settings', (req, res, next) => ctrl.updateSettings(req, res, next));
