const nodemailer = require('nodemailer');

// Create reusable transporter object using Gmail SMTP
const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER || "ayush21singla@gmail.com", // Your Gmail address
      pass: process.env.EMAIL_PASSWORD || 'cmps tgwk qctk hffo' // Your Gmail password or app password
    }
  });
};

// Send password reset email
const sendPasswordResetEmail = async (email, resetToken, resetUrl) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Apply For Me" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Request - Apply For Me',
      html: `
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
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
};

// Send password reset success email
const sendPasswordResetSuccessEmail = async (email) => {
  try {
    const transporter = createTransporter();
    
    const mailOptions = {
      from: `"Apply For Me" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Password Reset Successful - Apply For Me',
      html: `
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
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Password reset success email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset success email:', error);
    // Don't throw error for success email, just log it
    return { success: false, error: error.message };
  }
};

// Send job application email
const sendJobApplicationEmail = async (toEmail, subject, body, attachments = []) => {
  try {
    const transporter = createTransporter();
    const https = require('https');
    const http = require('http');
    
    // Process attachments - download from URLs if needed
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
              filename: attachment.filename,
              content: fileBuffer
            };
          } catch (downloadError) {
            console.error(`Error downloading attachment ${attachment.filename}:`, downloadError);
            // Return original attachment if download fails (nodemailer might handle URL)
            return attachment;
          }
        }
        // If it's already a local path or buffer, return as-is
        return attachment;
      })
    );
    
    const mailOptions = {
      from: `"Apply For Me" <${process.env.EMAIL_USER || 'ayush21singla@gmail.com'}>`,
      to: toEmail,
      subject: subject || 'Job Application - Apply For Me',
      html: `
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
      `,
      attachments: processedAttachments.length > 0 ? processedAttachments : undefined
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Job application email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
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

