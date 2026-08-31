const express = require('express');
const { loginUser } = require('../controllers/auth.controller.js'); // יבוא הנתונים מהקובץ המקביל בקונטרולרס

const router = express.Router(); // יוצרת רכיב Router חדש ב-Express שמאפשר לקבץ נתיבים קשורים יחד.

router.post('/login', loginUser);// מגדירה נתיב מסוג POST בכתובת /login. כשמגיעה בקשת התחברות לכתובת זו, Express מפעילה את הפונקציה loginUser.

module.exports = router; // ייצוא כדי לייבא בקובץ השרת הראשי
