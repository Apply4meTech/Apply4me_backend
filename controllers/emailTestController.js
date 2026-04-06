const {
  sendPaymentReceiptEmail,
  sendRegistrationWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
  sendJobApplicationEmail,
  isMailConfigured,
  getFromAddress
} = require('../utils/emailService');

/** Same From as production: EMAIL_FROM or SENDER_NAME + SENDER_EMAIL (see .env). */
const mailFrom = () => getFromAddress();

function isTestEmailEnabled() {
  if (process.env.NODE_ENV !== 'production') return true;
  return process.env.ENABLE_TEST_EMAIL === 'true';
}

function guard(req, res) {
  if (!isTestEmailEnabled()) {
    return res.status(403).json({
      success: false,
      error: 'Test email API is disabled. Set NODE_ENV=development or ENABLE_TEST_EMAIL=true'
    });
  }
  const secret = process.env.TEST_EMAIL_SECRET;
  if (secret && req.headers['x-test-secret'] !== secret) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing X-Test-Secret header'
    });
  }
  if (!isMailConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Mail not configured: set ZEPTOMAIL_API_URL and ZEPTOMAIL_API_TOKEN (ZeptoMail Send Mail Token) in .env'
    });
  }
  return null;
}

/**
 * GET /api/test/emails
 * Lists available test types and example POST body.
 */
const listTestEmailTypes = (req, res) => {
  const blocked = guard(req, res);
  if (blocked) return;
  res.json({
    success: true,
    from: mailFrom(),
    note: 'POST /api/test/emails/send with JSON body. Recipient is `to`. From matches EMAIL_FROM / SENDER_* in .env.',
    types: [
      {
        type: 'payment_receipt',
        description: 'Payment received / tax invoice',
        example: { type: 'payment_receipt', to: 'you@example.com' }
      },
      {
        type: 'registration_welcome',
        description: 'Sign-up confirmation (before payment)',
        example: { type: 'registration_welcome', to: 'you@example.com' }
      },
      {
        type: 'password_reset',
        description: 'Forgot-password link email',
        example: { type: 'password_reset', to: 'you@example.com' }
      },
      {
        type: 'password_reset_success',
        description: 'Password changed confirmation',
        example: { type: 'password_reset_success', to: 'you@example.com' }
      },
      {
        type: 'job_application',
        description: 'Job application email (no attachments in test)',
        example: { type: 'job_application', to: 'you@example.com' }
      }
    ]
  });
};

const baseUrl = process.env.FRONTEND_URL || 'http://localhost:3000';

/**
 * POST /api/test/emails/send
 * Body: { type: string, to: string }
 */
const sendTestEmail = async (req, res) => {
  const blocked = guard(req, res);
  if (blocked) return;

  const { type, to } = req.body || {};
  if (!to || !String(to).includes('@')) {
    return res.status(400).json({ success: false, error: 'Body must include valid `to` email' });
  }
  if (!type) {
    return res.status(400).json({ success: false, error: 'Body must include `type` (see GET /api/test/emails)' });
  }

  try {
    switch (type) {
      case 'payment_receipt': {
        const result = await sendPaymentReceiptEmail(
          {
            to,
            recipientName: 'Test User',
            amount: 89,
            currency: 'AUD',
            planName: 'Starter',
            billingPeriod: 'onetime',
            paymentIntentId: 'pi_test_postman_sample_001',
            completedAt: new Date(),
            invoiceId: 'test_invoice_id_001',
            websiteUrl: baseUrl
          },
          {}
        );
        if (!result.sent) {
          return res.status(502).json({ success: false, error: result.error || 'send failed', from: mailFrom() });
        }
        break;
      }
      case 'password_reset': {
        const resetUrl = `${baseUrl}/reset-password?token=test_token_postman`;
        await sendPasswordResetEmail(to, 'test_token_postman', resetUrl, {});
        break;
      }
      case 'password_reset_success': {
        await sendPasswordResetSuccessEmail(to, {});
        break;
      }
      case 'registration_welcome': {
        const result = await sendRegistrationWelcomeEmail(to, 'Test User', {});
        if (!result.sent) {
          return res.status(502).json({ success: false, error: result.error || 'send failed', from: mailFrom() });
        }
        break;
      }
      case 'job_application': {
        await sendJobApplicationEmail(
          to,
          'Application — Software Engineer (Test)',
          '<p>This is a <strong>test</strong> job application body from Postman.</p><p>Regards,<br/>Apply For Me</p>',
          [],
          {}
        );
        break;
      }
      default:
        return res.status(400).json({
          success: false,
          error: `Unknown type "${type}". Use GET /api/test/emails for list.`
        });
    }

    return res.json({
      success: true,
      message: `Email sent (${type})`,
      from: mailFrom(),
      to: String(to).trim()
    });
  } catch (err) {
    console.error('[emailTest]', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to send',
      from: mailFrom()
    });
  }
};

module.exports = {
  listTestEmailTypes,
  sendTestEmail
};
