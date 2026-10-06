
const express = require('express');
const router = express.Router();

const adminController = require('../controllers/admin.controller');

const requireAuth = require('../middlewares/auth.middleware');

router.get('/users', requireAuth, adminController.getAllUsers);
router.put('/users/:id', requireAuth, adminController.updateUserRole);
router.delete('/users/:id', requireAuth, adminController.deleteUser);
router.get('/stats', requireAuth, adminController.getSystemStats);
router.get('/renders', requireAuth, adminController.getAllRenders);
router.delete('/renders/:id', requireAuth, adminController.deleteRender);

module.exports = router;