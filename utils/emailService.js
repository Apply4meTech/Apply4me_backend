const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const { isMailConfigured, sendZeptoMailApi } = require('./zeptomailApi');
const { generateInvoicePdfToFile } = require('./invoicePdfGenerator');
const { uploadFileToS3 } = require('./s3Service');

/** Shared From: EMAIL_FROM, or SENDER_NAME + SENDER_EMAIL */
function getFromAddress() {
  if (process.env.EMAIL_FROM && String(process.env.EMAIL_FROM).trim()) {
    return process.env.EMAIL_FROM.trim();
  }
  const name = process.env.SENDER_NAME || process.env.EMAIL_SITE_NAME || 'Apply For Me';
  const addr =
    process.env.SENDER_EMAIL?.trim() ||
    process.env.SUPPORT_EMAIL?.trim();
  if (!addr) {
    return `"${name}" <noreply@localhost>`;
  }
  return `"${name}" <${addr}>`;
}

function getSiteName() {
  return process.env.EMAIL_SITE_NAME || process.env.SENDER_NAME || 'Apply For Me';
}

function resolveFrom(options) {
  if (options && options.fromOverride && String(options.fromOverride).trim()) {
    return String(options.fromOverride).trim();
  }
  return getFromAddress();
}

function formatMoney(amount, currency) {
  const code = (currency || 'AUD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: code }).format(Number(amount));
  } catch {
    return `${code} ${Number(amount).toFixed(2)}`;
  }
}

const { getAddonReceiptLabel } = require('./addonCatalog');

function planDisplayName(planName) {
  if (!planName) return 'Purchase';
  const addon = getAddonReceiptLabel(planName);
  if (addon) return addon;
  return planName;
}

/**
 * Send payment receipt to customer. Never throws — logs and returns { sent, error }.
 */
async function sendPaymentReceiptEmail(opts, options = {}) {
  const {
    to,
    recipientName,
    amount,
    currency,
    planName,
    billingPeriod,
    paymentIntentId,
    completedAt,
    invoiceId,
    websiteUrl
  } = opts;

  if (!to || !String(to).trim()) {
    return { sent: false, error: 'missing_email' };
  }

  if (!isMailConfigured()) {
    console.warn('[emailService] ZeptoMail not configured (ZEPTOMAIL_API_TOKEN); receipt email skipped');
    return { sent: false, error: 'mail_not_configured' };
  }

  const from = resolveFrom(options);
  const siteName = getSiteName();
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.SENDER_EMAIL;
  const siteUrl = (websiteUrl || process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const invoiceRef = invoiceId || paymentIntentId || '';
  const txDisplay = paymentIntentId ? String(paymentIntentId) : '—';
  const money = formatMoney(amount, currency);
  const planLabel = planDisplayName(planName);
  const periodLabel =
    billingPeriod === 'monthly'
      ? 'Monthly'
      : billingPeriod === 'quarterly'
        ? 'Quarterly'
        : 'One-time';
  const when = completedAt
    ? new Date(completedAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';

  const text = [
    greeting,
    '',
    `Thank you for your payment to ${siteName}.`,
    '',
    'Tax invoice / Payment receipt',
    invoiceRef ? `Invoice reference: ${invoiceRef}` : '',
    `Amount: ${money}`,
    `Plan / product: ${planLabel}`,
    `Billing: ${periodLabel}`,
    `Transaction ID: ${txDisplay}`,
    `Date: ${when}`,
    siteUrl ? `Website: ${siteUrl}` : '',
    '',
    `If you have questions, contact us at ${supportEmail}.`,
    '',
    `— ${siteName}`
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px;">
  <p>${greeting}</p>
  <p>Thank you for your payment to <strong>${escapeHtml(siteName)}</strong>.</p>
  <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 20px 0; background: #f8fafc;">
    <h2 style="margin: 0 0 12px; font-size: 1rem; color: #334155;">Tax invoice / Payment receipt</h2>
    <p style="margin: 0 0 12px; font-size: 0.875rem; color: #64748b;"><strong>${escapeHtml(siteName)}</strong>${siteUrl ? ` · <a href="${escapeHtml(siteUrl)}" style="color: #2563eb;">${escapeHtml(siteUrl)}</a>` : ''}</p>
    <table style="width: 100%; border-collapse: collapse; font-size: 0.9375rem;">
      ${invoiceRef ? `<tr><td style="padding: 4px 0; color: #64748b;">Invoice reference</td><td style="padding: 4px 0; text-align: right; font-size: 0.8125rem; word-break: break-all;">${escapeHtml(invoiceRef)}</td></tr>` : ''}
      <tr><td style="padding: 4px 0; color: #64748b;">Amount</td><td style="padding: 4px 0; text-align: right; font-weight: 600;">${escapeHtml(money)}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">Plan / product</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(planLabel)}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">Billing</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(periodLabel)}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">Transaction ID</td><td style="padding: 4px 0; text-align: right; font-size: 0.8125rem; word-break: break-all;">${escapeHtml(txDisplay)}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">Date</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(when)}</td></tr>
    </table>
  </div>
  <p style="font-size: 0.875rem; color: #64748b;">If you have questions, contact us at <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
  <p style="margin-top: 24px; font-size: 0.875rem; color: #94a3b8;">— ${escapeHtml(siteName)}</p>
</body>
</html>`;

  const subject = `${siteName} — Invoice / Receipt (${money})`;
  try {
    await sendZeptoMailApi({
      from,
      to: String(to).trim(),
      subject,
      text,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('[emailService] sendPaymentReceiptEmail failed:', err.message);
    return { sent: false, error: err.message };
  }
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Password reset link (forgot-password flow). Throws if mail not configured.
 */
async function sendPasswordResetEmail(email, _resetToken, resetUrl, options = {}) {
  if (!isMailConfigured()) {
    throw new Error('Email service not configured (set ZEPTOMAIL_API_TOKEN in .env)');
  }
  const siteName = getSiteName();
  const from = resolveFrom(options);
  const subject = `${siteName} — Reset your password`;
  const text = [
    `You requested a password reset for your ${siteName} account.`,
    '',
    `Open this link to choose a new password (valid for 1 hour):`,
    resetUrl,
    '',
    `If you did not request this, you can ignore this email.`,
    '',
    `— ${siteName}`
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px;">
  <p>You requested a password reset for your <strong>${escapeHtml(siteName)}</strong> account.</p>
  <p><a href="${escapeHtml(resetUrl)}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Reset password</a></p>
  <p style="font-size: 0.8125rem; word-break: break-all; color: #64748b;">Or copy this link:<br/>${escapeHtml(resetUrl)}</p>
  <p style="font-size: 0.875rem; color: #64748b;">This link expires in 1 hour. If you did not request this, ignore this email.</p>
  <p style="margin-top: 24px; font-size: 0.875rem; color: #94a3b8;">— ${escapeHtml(siteName)}</p>
</body></html>`;

  await sendZeptoMailApi({
    from,
    to: String(email).trim(),
    subject,
    text,
    html
  });
}

/**
 * After successful password change (reset-password flow).
 */
async function sendPasswordResetSuccessEmail(email, options = {}) {
  if (!isMailConfigured()) {
    console.warn('[emailService] ZeptoMail not configured; password reset success email skipped');
    return;
  }
  const siteName = getSiteName();
  const from = resolveFrom(options);
  const support = process.env.SUPPORT_EMAIL || process.env.SENDER_EMAIL;
  const subject = `${siteName} — Your password was changed`;
  const text = `Your password for ${siteName} was changed successfully.\n\nIf this was not you, contact ${support} immediately.\n\n— ${siteName}`;
  const html = `<p>Your password for <strong>${escapeHtml(siteName)}</strong> was changed successfully.</p>
<p style="font-size:0.875rem;color:#64748b;">If this was not you, contact <a href="mailto:${escapeHtml(support)}">${escapeHtml(support)}</a> immediately.</p>`;

  await sendZeptoMailApi({
    from,
    to: String(email).trim(),
    subject,
    text,
    html
  });
}

/**
 * Job application email to employer (optional file attachments).
 */
async function sendJobApplicationEmail(toEmail, subject, body, attachments = [], options = {}) {
  if (!isMailConfigured()) {
    throw new Error('Email service not configured (set ZEPTOMAIL_API_TOKEN in .env)');
  }
  const from = resolveFrom(options);
  const isHtml = typeof body === 'string' && body.includes('<') && body.includes('>');
  const text = isHtml ? body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : body;
  const html = isHtml
    ? body
    : `<div style="font-family: system-ui, sans-serif; white-space: pre-wrap;">${escapeHtml(body)}</div>`;

  const subj = subject || 'Application';
  const att = (attachments || []).filter((a) => a && a.path);

  await sendZeptoMailApi({
    from,
    to: String(toEmail).trim(),
    subject: subj,
    text,
    html,
    attachments: att
  });
}

/** Internal team notified when a new customer registers (role: user). */
const DEFAULT_NEW_CUSTOMER_NOTIFY_EMAILS = [
  'sneha.naidu95@gmail.com',
  'aryan.singla@applyforme.com.au',
  'ojus.madan@applyforme.com.au',
  'ayushsingla21.dev@gmail.com',
];

function getNewCustomerNotifyRecipients() {
  const raw = process.env.NEW_CUSTOMER_NOTIFY_EMAILS;
  if (raw != null && String(raw).trim()) {
    return String(raw)
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e && e.includes('@'));
  }
  return [...DEFAULT_NEW_CUSTOMER_NOTIFY_EMAILS];
}

/**
 * Notify internal team that a new customer signed up. Never throws; does not block signup.
 * @param {{ name: string, email: string, userId?: string, createdAt?: Date, referralCode?: string|null }} customer
 */
async function sendNewCustomerJoinNotification(customer, options = {}) {
  const recipients = getNewCustomerNotifyRecipients();
  if (!recipients.length) {
    return { sent: 0, skipped: true, reason: 'no_recipients' };
  }
  if (!customer?.email) {
    return { sent: 0, skipped: true, reason: 'missing_customer_email' };
  }
  if (!isMailConfigured()) {
    console.warn('[emailService] ZeptoMail not configured; new customer join notify skipped');
    return { sent: 0, error: 'mail_not_configured' };
  }

  const siteName = getSiteName();
  const from = resolveFrom(options);
  const adminUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const customerName = customer.name || customer.email;
  const customerEmail = String(customer.email).trim().toLowerCase();
  const when = customer.createdAt
    ? new Date(customer.createdAt).toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' })
    : new Date().toLocaleString('en-AU', { dateStyle: 'medium', timeStyle: 'short' });
  const referralLine = customer.referralCode
    ? `Referral code used: ${customer.referralCode}`
    : 'Referral code: none';

  const subject = `${siteName} — New customer joined (${customerName})`;
  const text = [
    'A new customer has registered on Apply For Me.',
    '',
    `Name: ${customerName}`,
    `Email: ${customerEmail}`,
    customer.userId ? `User ID: ${customer.userId}` : '',
    `Registered at: ${when}`,
    referralLine,
    adminUrl ? `Admin: ${adminUrl}/employee/admin/customers` : '',
    '',
    `— ${siteName}`,
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px;">
  <p>A new customer has registered on <strong>${escapeHtml(siteName)}</strong>.</p>
  <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 16px 0; background: #f8fafc;">
    <table style="width: 100%; border-collapse: collapse; font-size: 0.9375rem;">
      <tr><td style="padding: 4px 0; color: #64748b;">Name</td><td style="padding: 4px 0; text-align: right; font-weight: 600;">${escapeHtml(customerName)}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">Email</td><td style="padding: 4px 0; text-align: right; word-break: break-all;">${escapeHtml(customerEmail)}</td></tr>
      ${customer.userId ? `<tr><td style="padding: 4px 0; color: #64748b;">User ID</td><td style="padding: 4px 0; text-align: right; font-size: 0.8125rem;">${escapeHtml(customer.userId)}</td></tr>` : ''}
      <tr><td style="padding: 4px 0; color: #64748b;">Registered</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(when)}</td></tr>
      <tr><td style="padding: 4px 0; color: #64748b;">Referral</td><td style="padding: 4px 0; text-align: right;">${escapeHtml(customer.referralCode || 'none')}</td></tr>
    </table>
  </div>
  ${adminUrl ? `<p><a href="${escapeHtml(`${adminUrl}/employee/admin/customers`)}" style="color: #2563eb;">View customers in admin</a></p>` : ''}
  <p style="margin-top: 24px; font-size: 0.875rem; color: #94a3b8;">— ${escapeHtml(siteName)}</p>
</body></html>`;

  const results = await Promise.allSettled(
    recipients.map((recipient) =>
      sendZeptoMailApi({
        from,
        to: recipient,
        subject,
        text,
        html,
      })
    )
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  results.forEach((r, idx) => {
    if (r.status === 'rejected') {
      console.error(
        '[emailService] sendNewCustomerJoinNotification failed for',
        recipients[idx] || 'unknown',
        r.reason?.message || r.reason
      );
    }
  });
  const failed = results.length - sent;
  return { sent, total: recipients.length, failed };
}

/**
 * Registration confirmation (after sign-up, before payment). Never throws.
 */
async function sendRegistrationWelcomeEmail(to, recipientName, options = {}) {
  if (!to || !String(to).trim()) {
    return { sent: false, error: 'missing_email' };
  }
  if (!isMailConfigured()) {
    console.warn('[emailService] ZeptoMail not configured; registration email skipped');
    return { sent: false, error: 'mail_not_configured' };
  }
  const siteName = getSiteName();
  const from = resolveFrom(options);
  const siteUrl = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.SENDER_EMAIL;
  const greeting = recipientName ? `Hi ${recipientName},` : 'Hi,';
  const subject = `${siteName} — You're registered`;
  const text = [
    greeting,
    '',
    `Thanks for creating your ${siteName} account.`,
    '',
    'Next: complete onboarding and choose a plan when you are ready.',
    siteUrl ? `Open the app: ${siteUrl}` : '',
    '',
    `Questions? Reply to this email or write to ${supportEmail}.`,
    '',
    `— ${siteName}`
  ]
    .filter(Boolean)
    .join('\n');

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.5; color: #0f172a; max-width: 560px;">
  <p>${greeting}</p>
  <p>Thanks for creating your <strong>${escapeHtml(siteName)}</strong> account.</p>
  <p style="font-size: 0.9375rem; color: #334155;">Next: complete onboarding and choose a plan when you are ready.</p>
  ${siteUrl ? `<p><a href="${escapeHtml(siteUrl)}" style="display: inline-block; background: #2563eb; color: #fff; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Go to ${escapeHtml(siteName)}</a></p>` : ''}
  <p style="font-size: 0.875rem; color: #64748b;">Questions? Contact <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
  <p style="margin-top: 24px; font-size: 0.875rem; color: #94a3b8;">— ${escapeHtml(siteName)}</p>
</body></html>`;

  try {
    await sendZeptoMailApi({
      from,
      to: String(to).trim(),
      subject,
      text,
      html
    });
    return { sent: true };
  } catch (err) {
    console.error('[emailService] sendRegistrationWelcomeEmail failed:', err.message);
    return { sent: false, error: err.message };
  }
}

/**
 * Account activation welcome email with attached tax invoice PDF. Never throws.
 */
async function sendAccountActivatedWelcomeEmail(opts, options = {}) {
  const {
    to,
    recipientName,
    amount,
    currency,
    description,
    paymentReference,
    invoiceSeed,
    invoiceDate,
    customerAddress
  } = opts || {};

  if (!to || !String(to).trim()) {
    return { sent: false, error: 'missing_email' };
  }
  if (!isMailConfigured()) {
    console.warn('[emailService] ZeptoMail not configured; account activation email skipped');
    return { sent: false, error: 'mail_not_configured' };
  }

  const siteName = getSiteName();
  const from = resolveFrom(options);
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.SENDER_EMAIL || 'contactus@applyforme.com.au';
  const firstName = recipientName ? String(recipientName).trim().split(/\s+/)[0] : '';
  const greeting = firstName ? `Hi ${firstName},` : 'Hi,';
  const subject = `${siteName} - Account activated and invoice attached`;

  const text = [
    greeting,
    '',
    'Thank you for registering with Apply for Me.',
    'Your account has now been activated successfully.',
    'We’re excited to have you on board and will be in touch shortly with the next steps and further information to help you get started.',
    `If you have any questions in the meantime, please feel free to contact us on ${supportEmail}.`,
    'Kind regards,',
    'The Apply For Me Team',
    supportEmail
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.6; color: #0f172a; max-width: 620px;">
  <p>${escapeHtml(greeting)}</p>
  <p>Thank you for registering with Apply for Me.</p>
  <p>Your account has now been activated successfully.</p>
  <p>We’re excited to have you on board and will be in touch shortly with the next steps and further information to help you get started.</p>
  <p>If you have any questions in the meantime, please feel free to contact us on <a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a>.</p>
  <p>Kind regards,<br/>The Apply For Me Team<br/><a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a></p>
</body></html>`;

  let tempInvoicePath = null;
  try {
    const invoiceResult = await generateInvoicePdfToFile({
      amount: Number(amount) || 0,
      currency: currency || 'AUD',
      description: description || 'Apply for Me plan activation',
      quantity: 1,
      gst: 0,
      totalPaid: Number(amount) || 0,
      paymentMethod: 'Card',
      paymentReference: paymentReference || '',
      invoiceSeed: invoiceSeed || paymentReference || Date.now(),
      invoiceDate: invoiceDate || new Date(),
      customerName: recipientName || '[Customer Name]',
      customerAddress: customerAddress || '',
      customerEmail: String(to).trim()
    });
    tempInvoicePath = invoiceResult.outputPath;
    const invoiceBuffer = fs.readFileSync(tempInvoicePath);
    const uploadResult = await uploadFileToS3(
      invoiceBuffer,
      `ApplyForMe-Tax-Invoice-${invoiceResult.invoiceNumber}.pdf`,
      'application/pdf',
      'invoices'
    );

    await sendZeptoMailApi({
      from,
      to: String(to).trim(),
      subject,
      text,
      html,
      attachments: [
        {
          filename: `ApplyForMe-Tax-Invoice-${invoiceResult.invoiceNumber}.pdf`,
          path: tempInvoicePath
        }
      ]
    });
    return { sent: true, invoiceUpload: uploadResult };
  } catch (err) {
    console.error('[emailService] sendAccountActivatedWelcomeEmail failed:', err.message);
    return { sent: false, error: err.message };
  } finally {
    if (tempInvoicePath && fs.existsSync(tempInvoicePath)) {
      try {
        fs.unlinkSync(tempInvoicePath);
      } catch (cleanupErr) {
        console.warn('[emailService] Failed to clean temp invoice file:', cleanupErr.message);
      }
    }
  }
}

/**
 * Sends Chrome extension installation guide email with PDF attachment from URL.
 * Never throws.
 */
async function sendChromeExtensionGuideEmail(opts, options = {}) {
  const { to, recipientName, guidePdfUrl } = opts || {};
  if (!to || !String(to).trim()) {
    return { sent: false, error: 'missing_email' };
  }
  if (!isMailConfigured()) {
    console.warn('[emailService] ZeptoMail not configured; chrome guide email skipped');
    return { sent: false, error: 'mail_not_configured' };
  }

  const url = String(guidePdfUrl || process.env.CHROME_EXTENSION_GUIDE_PDF_URL || '').trim();
  if (!url) {
    return { sent: false, error: 'missing_guide_pdf_url' };
  }

  const from = resolveFrom(options);
  const firstName = recipientName ? String(recipientName).trim().split(/\s+/)[0] : '';
  const greeting = firstName ? `Dear ${firstName},` : 'Dear User,';
  const supportEmail = process.env.SUPPORT_EMAIL || process.env.SENDER_EMAIL || 'contactus@applyforme.com.au';
  const subject = 'Apply For Me Chrome Extension Installation Guide';

  const text = [
    greeting,
    'As part of the onboarding process, please find attached the installation guide for the Apply For Me Chrome Extension.',
    'The guide includes step-by-step instructions with screenshots to assist you through the installation process.',
    'Once the extension has been installed successfully, please log in using your registered account details.',
    'If you experience any issues or require assistance, please do not hesitate to contact our support team.',
    '',
    'Kind regards,',
    'The Apply For Me Team',
    '',
    supportEmail
  ].join('\n');

  const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; line-height: 1.6; color: #0f172a; max-width: 620px;">
  <p>${escapeHtml(greeting)}</p>
  <p>As part of the onboarding process, please find attached the installation guide for the Apply For Me Chrome Extension.</p>
  <p>The guide includes step-by-step instructions with screenshots to assist you through the installation process.</p>
  <p>Once the extension has been installed successfully, please log in using your registered account details.</p>
  <p>If you experience any issues or require assistance, please do not hesitate to contact our support team.</p>
  <p>Kind regards,<br/>The Apply For Me Team<br/><a href="mailto:${escapeHtml(supportEmail)}">${escapeHtml(supportEmail)}</a></p>
</body></html>`;

  const tempPdfPath = path.join(
    os.tmpdir(),
    `applyforme-chrome-guide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`
  );

  try {
    const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 120000 });
    fs.writeFileSync(tempPdfPath, Buffer.from(response.data));

    await sendZeptoMailApi({
      from,
      to: String(to).trim(),
      subject,
      text,
      html,
      attachments: [
        {
          filename: 'Apply-For-Me-Chrome-Extension-Installation-Guide.pdf',
          path: tempPdfPath
        }
      ]
    });
    return { sent: true };
  } catch (err) {
    console.error('[emailService] sendChromeExtensionGuideEmail failed:', err.message);
    return { sent: false, error: err.message };
  } finally {
    if (fs.existsSync(tempPdfPath)) {
      try {
        fs.unlinkSync(tempPdfPath);
      } catch (cleanupErr) {
        console.warn('[emailService] Failed to clean temp chrome guide file:', cleanupErr.message);
      }
    }
  }
}

module.exports = {
  getFromAddress,
  resolveFrom,
  isMailConfigured,
  getNewCustomerNotifyRecipients,
  sendPaymentReceiptEmail,
  sendAccountActivatedWelcomeEmail,
  sendChromeExtensionGuideEmail,
  sendRegistrationWelcomeEmail,
  sendNewCustomerJoinNotification,
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
  sendJobApplicationEmail,
};
