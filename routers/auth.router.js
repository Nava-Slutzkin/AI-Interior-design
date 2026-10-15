import express from 'express';
import { loginUser, registerUser, getCurrentUser, logoutUser } from '../controllers/auth.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

const router = express.Router(); // יוצרת רכיב Router חדש ב-Express שמאפשר לקבץ נתיבים קשורים יחד.

router.post('/login', loginUser); // מגדירה נתיב מסוג POST בכתובת /login. כשמגיעה בקשת התחברות לכתובת זו, Express מפעילה את הפונקציה loginUser.
router.post('/register', registerUser); // כאשר זו הכתובת הוא מעביר לפונקציה להרשמה
router.get('/me', requireAuth, getCurrentUser);
router.post('/logout', requireAuth, logoutUser);

export default router; // ייצוא כדי לייבא בקובץ השרת הראשי