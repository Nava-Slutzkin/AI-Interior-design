// מייבא את Express ויוצר router נפרד לנתיבי Render
const express = require('express');
const router = express.Router();
const { createRender, getUserRenders, getRenderById } = require('../controllers/render.controller.js');
const requireAuth = require('../middlewares/auth.middleware.js'); // ייבוא המידלוור מהקובץ שלך


// מייבא את הפונקציה שמעדכנת Render מה-controller
const renderController = require('../controllers/render.controller');

// נתיב לעדכון Render לפי מזהה
// לדוגמה: PUT /api/renders/123
router.put('/:id', renderController.updateRender);
// הגדרת נתיב למחיקת הדמיה לפי מזהה (DELETE /api/renders/:id)
router.delete('/:id', renderController.deleteRender);
// הנתיב מקבל קודם כל את דרישת ההתחברות (requireAuth), ורק אם היא עוברת, הוא ממשיך לפונקציית היצירה
router.post('/', requireAuth, createRender);
router.get('/', requireAuth, getUserRenders);
router.get('/:id', requireAuth, getRenderById);

module.exports = router;