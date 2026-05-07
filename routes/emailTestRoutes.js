const express = require('express');
const router = express.Router();
const { listTestEmailTypes, sendTestEmail } = require('../controllers/emailTestController');

router.get('/emails', listTestEmailTypes);
router.post('/emails/send', sendTestEmail);
router.post('/emails/send-welcome-invoice-by-user', (req, _res, next) => {
  req.body = {
    ...(req.body || {}),
    type: 'activation_welcome_invoice_by_user'
  };
  next();
}, sendTestEmail);

module.exports = router;
