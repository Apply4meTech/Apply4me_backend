const {
  sendPaymentReceiptEmail,
  sendAccountActivatedWelcomeEmail,
  sendRegistrationWelcomeEmail,
  sendNewCustomerJoinNotification,
  getNewCustomerNotifyRecipients,
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
  sendJobApplicationEmail,
  isMailConfigured,
  getFromAddress
} = require('../utils/emailService');
const User = require('../models/User');
const Payment = require('../models/Payment');

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
        type: 'new_customer_join_notify',
        description: 'Internal alert to NEW_CUSTOMER_NOTIFY_EMAILS (sample customer)',
        example: { type: 'new_customer_join_notify' }
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
      },
      {
        type: 'activation_welcome_invoice_by_user',
        description: 'Account activation welcome email + invoice PDF using existing user and latest successful payment',
        example: { type: 'activation_welcome_invoice_by_user', userId: 'USER_ID_HERE' }
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
  if (!type) {
    return res.status(400).json({ success: false, error: 'Body must include `type` (see GET /api/test/emails)' });
  }
  if (
    type !== 'activation_welcome_invoice_by_user' &&
    type !== 'new_customer_join_notify' &&
    (!to || !String(to).includes('@'))
  ) {
    return res.status(400).json({ success: false, error: 'Body must include valid `to` email' });
  }

  try {
    if (type === 'activation_welcome_invoice_by_user') {
      const { userId, paymentId, to: overrideTo } = req.body || {};
      if (!userId) {
        return res.status(400).json({ success: false, error: 'Body must include `userId` for this type' });
      }

      const user = await User.findById(userId).select('name email');
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found for provided userId' });
      }

      const paymentQuery = {
        userId: user._id,
        status: 'SUCCESS',
        gateway: 'STRIPE'
      };
      if (paymentId) paymentQuery._id = paymentId;

      const payment = await Payment.findOne(paymentQuery).sort({ completedAt: -1, createdAt: -1 });
      if (!payment) {
        return res.status(404).json({
          success: false,
          error: paymentId
            ? 'No successful STRIPE payment found for this userId + paymentId'
            : 'No successful STRIPE payment found for this user'
        });
      }

      const destinationEmail = overrideTo || payment.metadata?.customerEmail || user.email;
      const sendResult = await sendAccountActivatedWelcomeEmail({
        to: destinationEmail,
        recipientName: payment.metadata?.customerName || user.name,
        amount: payment.amount,
        currency: payment.currency || 'AUD',
        description: payment.planName
          ? `Apply for Me - ${payment.planName} plan`
          : 'Apply for Me plan activation',
        paymentReference: payment.stripePaymentIntentId || payment.transactionId,
        invoiceSeed: payment._id?.toString?.(),
        invoiceDate: payment.completedAt || payment.createdAt || new Date()
      });

      if (!sendResult.sent) {
        return res.status(502).json({
          success: false,
          error: sendResult.error || 'Failed to send activation welcome invoice email',
          userId: user._id,
          paymentId: payment._id
        });
      }

      if (sendResult.invoiceUpload) {
        payment.invoiceDocument = {
          fileName: sendResult.invoiceUpload.fileName,
          fileSize: sendResult.invoiceUpload.fileSize,
          resourceId: sendResult.invoiceUpload.resourceId,
          url: sendResult.invoiceUpload.url,
          key: sendResult.invoiceUpload.key,
          bucket: sendResult.invoiceUpload.bucket,
          mimeType: sendResult.invoiceUpload.mimeType,
          uploadedAt: sendResult.invoiceUpload.uploadedAt
            ? new Date(sendResult.invoiceUpload.uploadedAt)
            : new Date()
        };
      }
      payment.receiptEmailSentAt = new Date();
      await payment.save();

      return res.json({
        success: true,
        message: 'Activation welcome email + invoice sent',
        from: mailFrom(),
        to: destinationEmail,
        userId: user._id,
        paymentId: payment._id,
        invoiceDocument: payment.invoiceDocument || null
      });
    }

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
      case 'new_customer_join_notify': {
        const result = await sendNewCustomerJoinNotification({
          name: 'Test Customer',
          email: 'test.customer@example.com',
          userId: '000000000000000000000000',
          createdAt: new Date(),
          referralCode: null,
        });
        if (!result.sent) {
          return res.status(502).json({
            success: false,
            error: result.error || 'send failed',
            from: mailFrom(),
            recipients: getNewCustomerNotifyRecipients(),
          });
        }
        return res.json({
          success: true,
          message: 'New customer join notifications sent',
          from: mailFrom(),
          recipients: getNewCustomerNotifyRecipients(),
          sent: result.sent,
          total: result.total,
        });
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
