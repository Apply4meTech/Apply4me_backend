const axios = require('axios');

// ZeptoMail API configuration
const ZEPTOMAIL_API_URL = 'https://api.zeptomail.in/v1.1/email'; // Note: .in not .com
// Trim token to remove any accidental whitespace/newlines
const rawToken = process.env.ZEPTOMAIL_API_TOKEN ? process.env.ZEPTOMAIL_API_TOKEN.trim() : null;
// Check if token already includes the prefix, if not add it
const ZEPTOMAIL_API_TOKEN = "Zoho-enczapikey PHtE6r0EEOi/2m4o8BIF4/65Es6kZtwo9LgyeVNOtIhDCPNSS00Dr9h9kDfiqx8oUfRLQvGfnY48576fuuiBImy+NWZMWWqyqK3sx/VYSPOZsbq6x00bslUedk3aUIXnc9dp0CLSv93bNA=="
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'contactus@applyforme.com.au';
const SENDER_NAME = process.env.SENDER_NAME || 'Apply For Me';

// Helper function to send email via ZeptoMail API
const sendEmailViaZeptoMail = async (to, subject, htmlContent, attachments = []) => {
  if (!ZEPTOMAIL_API_TOKEN) {
    throw new Error('ZeptoMail API token is not configured. Please set ZEPTOMAIL_API_TOKEN in your environment variables.');
  }

  // Validate token format (should not be empty after trim)
  if (ZEPTOMAIL_API_TOKEN.length === 0) {
    throw new Error('ZeptoMail API token is empty. Please check your .env file and ensure ZEPTOMAIL_API_TOKEN has a value.');
  }

  // Log token info for debugging (first 10 and last 10 chars only for security)
  const tokenPreview = ZEPTOMAIL_API_TOKEN.length > 20 
    ? `${ZEPTOMAIL_API_TOKEN.substring(0, 10)}...${ZEPTOMAIL_API_TOKEN.substring(ZEPTOMAIL_API_TOKEN.length - 10)}`
    : '***';
  console.log('Using ZeptoMail API Token (preview):', tokenPreview, 'Length:', ZEPTOMAIL_API_TOKEN.length);

  // Prepare recipient array
  const toArray = Array.isArray(to) ? to : [to];
  
  // Match exact format from working curl request - declare outside try for error logging
  let emailData;
  
  try {
    emailData = {
      from: {
        address: SENDER_EMAIL
      },
      to: toArray.map(email => {
        // Extract name from email if it's an object, otherwise use email as address
        if (typeof email === 'object' && email.address) {
          return {
            email_address: {
              address: email.address,
              name: email.name || email.address.split('@')[0] || 'User'
            }
          };
        }
        // If email is just a string, extract name from email address
        const emailStr = String(email);
        const name = emailStr.split('@')[0] || 'User';
        return {
          email_address: {
            address: emailStr,
            name: name
          }
        };
      }),
      subject: subject,
      htmlbody: htmlContent
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
      emailData.attachments = attachments.map(att => {
        // If attachment has content (buffer), convert to base64
        if (att.content) {
          return {
            filename: att.filename || 'attachment',
            content: Buffer.isBuffer(att.content) ? att.content.toString('base64') : att.content,
            encoding: 'base64'
          };
        }
        // If attachment has path (URL), we'll need to download it first
        return {
          filename: att.filename || 'attachment',
          content: att.path,
          encoding: 'url'
        };
      });
    }

    // Log request details for debugging (without sensitive data)
    console.log('Sending email via ZeptoMail:', {
      from: SENDER_EMAIL,
      to: toArray,
      subject: subject,
      hasAttachments: attachments && attachments.length > 0
    });

    // Log the exact request payload (for debugging)
    console.log('ZeptoMail Request Payload:', JSON.stringify(emailData, null, 2));

    const response = await axios.post(ZEPTOMAIL_API_URL, emailData, {
      headers: {
        'Authorization': ZEPTOMAIL_API_TOKEN, // Token already includes "Zoho-enczapikey" prefix
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    console.log('Email sent via ZeptoMail - Full Response:', JSON.stringify(response.data, null, 2));
    
    // Check if response indicates success
    if (response.data && response.data.message === 'OK') {
      return { 
        success: true, 
        messageId: response.data.request_id || 'sent',
        requestId: response.data.request_id
      };
    }
    
    return { success: true, messageId: 'sent' };
  } catch (error) {
    // Enhanced error logging
    const errorDetails = error.response?.data || {};
    const errorMessage = errorDetails.error?.message || errorDetails.message || error.message;
    const errorCode = errorDetails.error?.code || errorDetails.code;
    
    // Include request payload in error log if available
    const requestPayload = emailData ? JSON.stringify(emailData, null, 2) : 'Request payload not available';
    
    console.error('ZeptoMail API Error Details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      errorCode: errorCode,
      errorMessage: errorMessage,
      fullError: JSON.stringify(errorDetails, null, 2),
      requestUrl: ZEPTOMAIL_API_URL,
      requestPayload: requestPayload
    });

    // Provide more helpful error messages
    if (errorCode === 'TM_4001') {
      const details = errorDetails.error?.details || [];
      const hasInvalidToken = details.some(d => d.code === 'SERR_157');
      
      if (hasInvalidToken) {
        throw new Error(`ZeptoMail Invalid API Token (SERR_157). Please check: 1) Copy the token from Agents >> SMTP/API >> Send Mail Token, 2) Ensure no extra spaces/newlines in .env file, 3) Token must be from the same Agent as sender address '${SENDER_EMAIL}', 4) Regenerate token if needed. Full error: ${JSON.stringify(errorDetails)}`);
      }
      throw new Error(`ZeptoMail Access Denied (TM_4001). Please verify: 1) API token is correct, 2) Sender address '${SENDER_EMAIL}' is added to your agent, 3) Domain is verified. Full error: ${JSON.stringify(errorDetails)}`);
    }
    
    throw new Error(`Failed to send email: ${errorMessage || JSON.stringify(errorDetails)}`);
  }
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, resetUrl) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #2463eb; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">Apply For Me</h1>
        </div>
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #111318; margin-top: 0;">Password Reset Request</h2>
          <p>You requested to reset your password. Click the button below to reset it:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="display: inline-block; background-color: #2463eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Reset Password
            </a>
          </div>
          <p style="color: #64748b; font-size: 14px;">Or copy and paste this link into your browser:</p>
          <p style="color: #2463eb; font-size: 12px; word-break: break-all;">${resetUrl}</p>
          <p style="color: #64748b; font-size: 14px; margin-top: 30px;">
            This link will expire in 1 hour. If you didn't request this password reset, please ignore this email.
          </p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Apply For Me Inc. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmailViaZeptoMail(email, 'Password Reset Request - Apply For Me', htmlContent);
    console.log('Password reset email sent:', result.messageId);
    return result;
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

// Send password reset success email
const sendPasswordResetSuccessEmail = async (email) => {
  try {
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Successful</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #10b981; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">Apply For Me</h1>
        </div>
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #111318; margin-top: 0;">Password Reset Successful</h2>
          <p>Your password has been successfully reset.</p>
          <p>If you did not make this change, please contact our support team immediately.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Apply For Me Inc. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmailViaZeptoMail(email, 'Password Reset Successful - Apply For Me', htmlContent);
    console.log('Password reset success email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending password reset success email:', error);
    // Don't throw error for success email, just log it
    return { success: false, error: error.message };
  }
};

// Send job application email
const sendJobApplicationEmail = async (toEmail, subject, body, attachments = []) => {
  try {
    const https = require('https');
    const http = require('http');
    
    // Process attachments - download from URLs if needed for ZeptoMail
    const processedAttachments = await Promise.all(
      attachments.map(async (attachment) => {
        // If attachment has a URL (S3 or other), download it
        if (attachment.path && (attachment.path.startsWith('http://') || attachment.path.startsWith('https://'))) {
          try {
            const fileBuffer = await new Promise((resolve, reject) => {
              const protocol = attachment.path.startsWith('https://') ? https : http;
              protocol.get(attachment.path, (response) => {
                if (response.statusCode !== 200) {
                  reject(new Error(`Failed to download file: ${response.statusCode}`));
                  return;
                }
                const chunks = [];
                response.on('data', (chunk) => chunks.push(chunk));
                response.on('end', () => resolve(Buffer.concat(chunks)));
                response.on('error', reject);
              }).on('error', reject);
            });
            
            return {
              filename: attachment.filename || 'attachment',
              content: fileBuffer
            };
          } catch (downloadError) {
            console.error(`Error downloading attachment ${attachment.filename}:`, downloadError);
            throw downloadError;
          }
        }
        // If it's already a buffer, return as-is
        if (Buffer.isBuffer(attachment.content)) {
          return {
            filename: attachment.filename || 'attachment',
            content: attachment.content
          };
        }
        // Return original attachment
        return attachment;
      })
    );
    
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Application</title>
      </head>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background-color: #2463eb; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0;">Apply For Me</h1>
        </div>
        <div style="background-color: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px;">
          <h2 style="color: #111318; margin-top: 0;">Job Application</h2>
          <div style="white-space: pre-wrap; color: #0f172a; margin: 20px 0;">
            ${body || 'No message content provided.'}
          </div>
          ${processedAttachments.length > 0 ? `
            <div style="margin-top: 20px; padding: 15px; background-color: #eff6ff; border-radius: 6px; border-left: 4px solid #2463eb;">
              <p style="margin: 0; color: #0f172a; font-weight: 600;">Attachments:</p>
              <ul style="margin: 10px 0 0 0; padding-left: 20px; color: #64748b;">
                ${processedAttachments.map(att => `<li>${att.filename || 'File'}</li>`).join('')}
              </ul>
            </div>
          ` : ''}
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
          <p style="color: #94a3b8; font-size: 12px; margin: 0;">
            © ${new Date().getFullYear()} Apply For Me Inc. All rights reserved.
          </p>
        </div>
      </body>
      </html>
    `;

    const result = await sendEmailViaZeptoMail(
      toEmail, 
      subject || 'Job Application - Apply For Me', 
      htmlContent,
      processedAttachments.length > 0 ? processedAttachments : []
    );
    console.log('Job application email sent:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending job application email:', error);
    throw new Error('Failed to send email: ' + error.message);
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
  sendJobApplicationEmail
};


