const { isMailConfigured, sendZeptoMailApi } = require('./zeptomailApi');

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

module.exports = {
  getFromAddress,
  resolveFrom,
  isMailConfigured,
  sendPaymentReceiptEmail,
  sendRegistrationWelcomeEmail,
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
  sendJobApplicationEmail
};
