const express = require('express');
const router = express.Router();
const { listTestEmailTypes, sendTestEmail } = require('../controllers/emailTestController');

router.get('/emails', listTestEmailTypes);
router.post('/emails/send', sendTestEmail);

module.exports = router;
