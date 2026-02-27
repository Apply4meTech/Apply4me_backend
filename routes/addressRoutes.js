const express = require('express');
const router = express.Router();
const { getAddressSuggestions, getPlaceDetails } = require('../controllers/addressController');

// Address autocomplete routes (public - no auth required for autocomplete)
router.get('/suggestions', getAddressSuggestions);
router.get('/details', getPlaceDetails);

module.exports = router;

