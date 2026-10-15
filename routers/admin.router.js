
import express from 'express';
const router = express.Router();

import * as adminController from '../controllers/admin.controller.js';

import { requireAuth, requireAdmin } from '../middlewares/auth.middleware.js';

router.get('/users', requireAuth, requireAdmin, adminController.getAllUsers);
router.get('/renders', requireAuth, requireAdmin, adminController.getAllRenders);
router.put('/users/:id', requireAuth, requireAdmin, adminController.updateUserRole);
router.delete('/users/:id', requireAuth, requireAdmin, adminController.deleteUser);
router.delete('/renders/:id', requireAuth, requireAdmin, adminController.deleteRender);
router.get('/stats', requireAuth, requireAdmin, adminController.getSystemStats);

export default router;