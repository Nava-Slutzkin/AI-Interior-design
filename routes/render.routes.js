// מייבא את Express ויוצר router נפרד לנתיבי Render
const express = require('express');
const router = express.Router();

// מייבא את הפונקציה שמעדכנת Render מה-controller
const { updateRender, deleteRender } = require('../controllers/render.controller');

// נתיב לעדכון Render לפי מזהה
// לדוגמה: PUT /api/renders/123
router.put('/:id', updateRender);

// הגדרת נתיב למחיקת הדמיה לפי מזהה (DELETE /api/renders/:id)
router.delete('/:id', deleteRender);

// מייצא את ה-router כדי שהשרת הראשי יוכל להשתמש בו
module.exports = router;