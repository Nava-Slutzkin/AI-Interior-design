const express = require('express');
const router = express.Router();
const { updateRender } = require('../controllers/render.controller');
const { authMiddleware } = require('../middlewares/auth.middleware'); 

router.put('/:id', authMiddleware, updateRender);
module.exports = router;