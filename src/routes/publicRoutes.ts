import { Router } from 'express';
import { listProjects, getProjectById } from '../controllers/projectController';

const router = Router();

router.get('/projects', listProjects);
router.get('/projects/:id', getProjectById);

export default router;
