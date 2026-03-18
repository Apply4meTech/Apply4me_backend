const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getDashboard,
  logClick,
  validateCode
} = require('../controllers/affiliateController');
const { verifyAffiliateToken } = require('../middleware/affiliateAuth');

router.post('/register', register);
router.post('/login', login);
router.get('/validate/:code', validateCode);
router.post('/click', logClick);

router.get('/dashboard', verifyAffiliateToken, getDashboard);

module.exports = router;
