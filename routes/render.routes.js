const express = require('express');
const router = express.Router();
const { createRender, getRenderById, updateRender } = require('../controllers/render.controller');

router.put('/:id', updateRender);

module.exports = router;