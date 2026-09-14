const express = require('express');
const router = express.Router();

// 1. ייבוא מרכזי של כל הפונקציות מה-Controller
const { 
    createRender, 
    getUserRenders, 
    getRenderById, 
    updateRender, 
    deleteRender 
} = require('../controllers/render.controller');

// 2. ייבוא ה-Middleware לאימות המשתמש
const requireAuth = require('../middlewares/auth.middleware');

// 3. הגדרת הנתיבים המוגנים
router.post('/', requireAuth, createRender);
router.get('/', requireAuth, getUserRenders);
router.get('/:id', requireAuth, getRenderById);
router.put('/:id', requireAuth, updateRender);
router.delete('/:id', requireAuth, deleteRender);

module.exports = router;