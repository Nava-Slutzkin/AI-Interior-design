
const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');

const requireAuth = require('../middlewares/auth.middleware');

router.get('/users', requireAuth, adminController.getAllUsers);
router.put('/users/:id', requireAuth, adminController.updateUserRole);
router.delete('/users/:id', requireAuth, adminController.deleteUser);
router.get('/stats', requireAuth, adminController.getSystemStats);

// שליפת כל המשתמשים
router.get('/users', adminController.getAllUsers);

// עדכון משתמש (תפקיד)
router.put('/users/:id', adminController.updateUserRole);

// מחיקת משתמש
router.delete('/users/:id', adminController.deleteUser);

// סטטיסטיקות מערכת
router.get('/stats', adminController.getSystemStats);

module.exports = router;