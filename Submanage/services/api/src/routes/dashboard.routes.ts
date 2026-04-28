import { Router } from 'express';

import { DashboardController } from '../controllers/dashboard.controller.js';
import { authenticate } from '../middlewares/auth.js';

export const dashboardRouter = Router();
const ctrl = new DashboardController();

dashboardRouter.use(authenticate);

dashboardRouter.get('/', (req, res, next) => ctrl.getDashboard(req, res, next));
dashboardRouter.get('/reports/monthly', (req, res, next) => ctrl.getMonthlyReport(req, res, next));

// 정렬 파라미터 지원: ?sort=billing_date|amount|category (CLAUDE.md §10, TASK-025)
dashboardRouter.get('/subscriptions', (req, res, next) => ctrl.getSubscriptions(req, res, next));
