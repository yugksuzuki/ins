const express = require('express');
const router = express.Router();
const imageController = require('../controllers/imageController');

// Sem multer, pois estamos enviando base64
router.post('/upload', imageController.uploadImage);

module.exports = router;