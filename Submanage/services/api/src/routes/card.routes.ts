import { Router } from 'express';

import { CardController } from '../controllers/card.controller.js';
import { authenticate } from '../middlewares/auth.js';

export const cardRouter = Router();
const ctrl = new CardController();

cardRouter.use(authenticate);

cardRouter.get('/', (req, res, next) => ctrl.list(req, res, next));
cardRouter.post('/link', (req, res, next) => ctrl.link(req, res, next));
cardRouter.delete('/:id', (req, res, next) => ctrl.unlink(req, res, next));
