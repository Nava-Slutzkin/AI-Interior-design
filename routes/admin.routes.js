const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');

// שליפת כל המשתמשים
router.get('/users', adminController.getAllUsers);

// עדכון משתמש (תפקיד)
router.put('/users/:id', adminController.updateUserRole);

// מחיקת משתמש
router.delete('/users/:id', adminController.deleteUser);

// סטטיסטיקות מערכת
router.get('/stats', adminController.getSystemStats);

module.exports = router;