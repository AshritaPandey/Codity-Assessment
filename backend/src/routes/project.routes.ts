import { Router } from 'express';
import { createProject, getProjects } from '../controllers/project.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);
router.post('/', createProject);
router.get('/', getProjects);

export default router;
