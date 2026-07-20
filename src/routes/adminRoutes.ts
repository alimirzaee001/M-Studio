import { Router } from 'express';
import { requireAdmin } from '../middleware/requireAdmin';
import { uploadMediaFields, uploadSingle } from '../middleware/upload';
import {
  createProject,
  updateProject,
  deleteProject,
} from '../controllers/projectController';
import {
  createSection,
  reorderSections,
  updateSection,
  deleteSection,
} from '../controllers/sectionController';
import { createMedia, reorderMedia, deleteMedia } from '../controllers/mediaController';
import { uploadImage } from '../controllers/uploadController';
import {
  getSiteSettings,
  updateSiteSettings,
} from '../controllers/siteSettingsController';

const router = Router();

router.use(requireAdmin);

router.post('/upload', uploadSingle, uploadImage);

router.get('/site-settings', getSiteSettings);
router.put('/site-settings', updateSiteSettings);

router.post('/projects', createProject);
router.put('/projects/:id', updateProject);
router.delete('/projects/:id', deleteProject);

router.post('/projects/:id/sections', createSection);
router.put('/sections/:section_id', updateSection);
router.put('/sections/:section_id/reorder', reorderSections);
router.delete('/sections/:section_id', deleteSection);

router.post('/sections/:section_id/media', uploadMediaFields, createMedia);
router.put('/media/:media_id/reorder', reorderMedia);
router.delete('/media/:media_id', deleteMedia);

export default router;
