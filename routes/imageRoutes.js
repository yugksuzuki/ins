// routes/imageRoutes.js
const router = require('express').Router();
const imageController = require('../controllers/imageController');

// Montado em /api/images
router.post('/', imageController.uploadImage);

module.exports = router;
