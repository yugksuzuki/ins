// routes/compareRoutes.js
const router = require('express').Router();
const compareController = require('../controllers/compareController');

// Montado em /api/compare
router.post('/', compareController.compare);

module.exports = router;
