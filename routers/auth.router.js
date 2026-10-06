const express = require('express');
const { loginUser, registerUser, getCurrentUser, logoutUser } = require('../controllers/auth.controller.js');
const requireAuth = require('../middlewares/auth.middleware');

const router = express.Router(); // יוצרת רכיב Router חדש ב-Express שמאפשר לקבץ נתיבים קשורים יחד.

router.post('/login', loginUser); // מגדירה נתיב מסוג POST בכתובת /login. כשמגיעה בקשת התחברות לכתובת זו, Express מפעילה את הפונקציה loginUser.
router.post('/register', registerUser); // כאשר זו הכתובת הוא מעביר לפונקציה להרשמה
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', requireAuth, logoutUser);

module.exports = router; // ייצוא כדי לייבא בקובץ השרת הראשי