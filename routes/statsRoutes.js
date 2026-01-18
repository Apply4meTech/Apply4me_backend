const express = require('express');
const router = express.Router();
const { getStats } = require('../controllers/statsController');

// Stats route
router.get('/', getStats);

module.exports = router;
