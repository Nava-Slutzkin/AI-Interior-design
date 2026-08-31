// מייבא את Express ויוצר router נפרד לנתיבי Render
const express = require('express');
const router = express.Router();

// מייבא את הפונקציה שמעדכנת Render מה-controller
const { updateRender } = require('../controllers/render.controller');

// נתיב לעדכון Render לפי מזהה
// לדוגמה: PUT /api/renders/123
router.put('/:id', updateRender);

// מייצא את ה-router כדי שהשרת הראשי יוכל להשתמש בו
module.exports = router;