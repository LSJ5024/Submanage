import { Router } from 'express';

import { AdminController } from '../controllers/admin.controller.js';
import { authenticate, requireAdmin } from '../middlewares/auth.js';

export const adminRouter = Router();
const ctrl = new AdminController();

// 관리자 전용 — JWT 인증 + Admin 권한 검증 (CLAUDE.md §7)
adminRouter.use(authenticate, requireAdmin);

adminRouter.post('/cancel-guides', (req, res, next) => ctrl.createGuide(req, res, next));
adminRouter.patch('/cancel-guides/:id', (req, res, next) => ctrl.updateGuide(req, res, next));
adminRouter.get('/cancel-guides', (req, res, next) => ctrl.listGuides(req, res, next));
