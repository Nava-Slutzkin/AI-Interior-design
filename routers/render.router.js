const express = require('express');
const router = express.Router();
const { createRender, getUserRenders, getRenderById } = require('../controllers/render.controller.js');
const requireAuth = require('../middlewares/auth.middleware.js'); // ייבוא המידלוור מהקובץ שלך

// הנתיב מקבל קודם כל את דרישת ההתחברות (requireAuth), ורק אם היא עוברת, הוא ממשיך לפונקציית היצירה
router.post('/', requireAuth, createRender);
router.get('/', requireAuth, getUserRenders);
router.get('/:id', requireAuth, getRenderById);

module.exports = router;