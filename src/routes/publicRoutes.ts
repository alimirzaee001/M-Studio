import { Router } from 'express';
import { listProjects, getProjectById } from '../controllers/projectController';
import { getSiteSettings } from '../controllers/siteSettingsController';

const router = Router();

router.get('/projects', listProjects);
router.get('/projects/:id', getProjectById);
router.get('/site-settings', getSiteSettings);

export default router;
