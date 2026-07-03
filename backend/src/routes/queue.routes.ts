import { Router } from 'express';
import { createQueue, getQueues, updateQueue, getQueueStats } from '../controllers/queue.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.post('/', createQueue);
router.get('/', getQueues);
router.patch('/:id', updateQueue);
router.get('/:id/stats', getQueueStats);

export default router;
