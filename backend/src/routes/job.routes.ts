import { Router } from 'express';
import { createJob, getJobs, retryJob, getJobStats } from '../controllers/job.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.get('/stats', getJobStats);
router.post('/', createJob);
router.get('/', getJobs);
router.post('/:id/retry', retryJob);

export default router;
