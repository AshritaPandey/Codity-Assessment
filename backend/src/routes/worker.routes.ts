import { Router } from 'express';
import { getWorkers } from '../controllers/worker.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/', getWorkers);

export default router;
