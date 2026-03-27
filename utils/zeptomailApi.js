const axios = require('axios');
const fs = require('fs');
const path = require('path');

/** India DC; override with ZEPTOMAIL_API_URL if your account uses api.zeptomail.com */
const DEFAULT_API_URL = 'https://api.zeptomail.in/v1.1/email';

function sanitizeToken(raw) {
  if (raw == null) return '';
  return String(raw)
    .replace(/^\uFEFF/, '')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .trim()
    .replace(/\s+/g, '');
}

/**
 * Send Mail Token from ZeptoMail → Agents → Mail Agent → SMTP/API.
 * Prefer ZEPTOMAIL_API_TOKEN; SMTP_PASS kept as legacy alias.
 */
function getZeptoMailToken() {
  return sanitizeToken(process.env.ZEPTOMAIL_API_TOKEN || process.env.SMTP_PASS);
}

function isMailConfigured() {
  return !!getZeptoMailToken();
}

/** Parse "Name" <a@b.com> or a@b.com */
function parseFromAddress(fromStr) {
  const s = String(fromStr).trim();
  const angle = s.match(/^(.+?)\s*<([^>]+)>$/);
  if (angle) {
    const name = angle[1].trim().replace(/^["']|["']$/g, '');
    return {
      name: name || process.env.SENDER_NAME || 'Apply For Me',
      address: angle[2].trim()
    };
  }
  if (s.includes('@')) {
    return {
      name: (process.env.SENDER_NAME || 'Apply For Me').replace(/^["']|["']$/g, ''),
      address: s
    };
  }
  return { name: process.env.SENDER_NAME || 'Apply For Me', address: s };
}

function guessMime(filename) {
  const ext = path.extname(filename).toLowerCase();
  const map = {
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx':
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.txt': 'text/plain',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg'
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * @param {Object} p
 * @param {string} p.from
 * @param {string} p.to
 * @param {string} p.subject
 * @param {string} p.text
 * @param {string} p.html
 * @param {Array<{ filename?: string, path: string }>} [p.attachments]
 */
async function sendZeptoMailApi({ from, to, subject, text, html, attachments = [] }) {
  const token = getZeptoMailToken();
  if (!token) {
    throw new Error('ZeptoMail: set ZEPTOMAIL_API_TOKEN (Send Mail Token) in .env');
  }

  const { name, address } = parseFromAddress(from);
  const apiUrl = process.env.ZEPTOMAIL_API_URL?.trim() || DEFAULT_API_URL;

  const body = {
    from: {
      address,
      name: name || 'Apply For Me'
    },
    to: [{ email_address: { address: String(to).trim() } }],
    subject: subject || '(no subject)',
    textbody: text || '',
    htmlbody: html || text || ''
  };

  const list = (attachments || [])
    .filter((a) => a && a.path && fs.existsSync(a.path))
    .map((a) => {
      const fn = a.filename || path.basename(a.path);
      return {
        name: fn,
        content: fs.readFileSync(a.path).toString('base64'),
        mime_type: guessMime(fn)
      };
    });
  if (list.length) {
    body.attachments = list;
  }

  await axios.post(apiUrl, body, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Zoho-enczapikey ${token}`
    },
    timeout: 120000,
    maxContentLength: Infinity,
    maxBodyLength: Infinity,
    validateStatus: (s) => s >= 200 && s < 300
  });
}

module.exports = {
  sanitizeToken,
  getZeptoMailToken,
  isMailConfigured,
  sendZeptoMailApi,
  parseFromAddress
};
