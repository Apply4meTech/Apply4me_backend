/**
 * Test ZeptoMail HTTP API auth (same token as Zoho-enczapikey, not SMTP).
 * Sends one test email if VERIFY_EMAIL_TO is set; otherwise only validates token length.
 * Usage: npm run verify:zeptomail
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { getZeptoMailToken, sendZeptoMailApi } = require('../utils/zeptomailApi');
const { getFromAddress } = require('../utils/emailService');

async function main() {
  const token = getZeptoMailToken();
  console.log('Send Mail Token length:', token.length);
  if (!token.length) {
    console.error('Set ZEPTOMAIL_API_TOKEN (or legacy SMTP_PASS) in .env.');
    process.exit(1);
  }

  const to = process.env.VERIFY_EMAIL_TO?.trim();
  if (!to) {
    console.log(
      'Optional: set VERIFY_EMAIL_TO=you@example.com in .env to send a real test email.'
    );
    console.log('Token is present; restart the server and try Postman.');
    return;
  }

  try {
    await sendZeptoMailApi({
      from: getFromAddress(),
      to,
      subject: 'Apply For Me — ZeptoMail API test',
      text: 'If you receive this, ZeptoMail HTTP API auth works.',
      html: '<p>If you receive this, ZeptoMail HTTP API auth works.</p>'
    });
    console.log('OK: API request accepted. Check inbox:', to);
  } catch (err) {
    const status = err.response?.status;
    const data = err.response?.data;
    console.error('FAIL:', status, data || err.message);
    process.exit(1);
  }
}

main();
