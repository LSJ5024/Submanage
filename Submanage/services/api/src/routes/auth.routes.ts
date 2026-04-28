import { Router } from 'express';

import { AuthController } from '../controllers/auth.controller.js';

export const authRouter = Router();
const ctrl = new AuthController();

authRouter.post('/register', (req, res, next) => ctrl.register(req, res, next));
authRouter.post('/login', (req, res, next) => ctrl.login(req, res, next));
authRouter.post('/refresh', (req, res, next) => ctrl.refresh(req, res, next));
