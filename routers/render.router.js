import express from 'express';
const router = express.Router();

// 1. ייבוא מרכזי של כל הפונקציות מה-Controller
import {
    createRender, 
    getUserRenders, 
    getRenderById, 
    getRoomImages,
    updateRender, 
    deleteRender 
} from '../controllers/render.controller.js';

// 2. ייבוא ה-Middleware לאימות המשתמש
import { requireAuth } from '../middlewares/auth.middleware.js';

// 3. הגדרת הנתיבים המוגנים
router.post('/', requireAuth, createRender);
router.get('/', requireAuth, getUserRenders);
router.get('/images', requireAuth, getRoomImages);
router.post('/images', requireAuth, getRoomImages);
router.get('/:id', requireAuth, getRenderById);
router.put('/:id', requireAuth, updateRender);
router.delete('/:id', requireAuth, deleteRender);

export default router;