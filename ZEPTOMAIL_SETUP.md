# ZeptoMail Setup Guide

This document explains how to configure Zoho ZeptoMail for sending transactional emails from your application.

## Overview

The application has been configured to use **Zoho ZeptoMail API** instead of Gmail SMTP. All emails will be sent from `contactus@applyforme.com.au` using your verified domain `applyforme.com.au`.

## Prerequisites

1. ✅ Domain `applyforme.com.au` is verified in ZeptoMail
2. ✅ DKIM and CNAME records are configured and verified
3. ⚠️ **Action Required**: Add `contactus@applyforme.com.au` as a sender address in ZeptoMail

## Step 1: Add Sender Address in ZeptoMail

Before you can send emails, you need to add `contactus@applyforme.com.au` as a sender address:

1. Log in to your ZeptoMail account at [zeptomail.zoho.in](https://zeptomail.zoho.in)
2. Navigate to **Domains** → Select `applyforme.com.au`
3. In the **Sender Address Restriction** section, click **"Add Sender Address"**
4. Fill in the form:
   - **Agent**: Select your mail agent (e.g., `mail_agent_1`)
   - **Sender Address**: `contactus@applyforme.com.au`
5. The sender address will be automatically verified since your domain is already verified

## Step 2: Get Your ZeptoMail API Token

The API token is located in the **Agents** section, not in Settings. Follow these steps:

1. In ZeptoMail dashboard, click on **"Agents"** in the left sidebar
2. Select your agent (e.g., `mail_agent_1`) - the one you associated with your sender address
3. Click on **"SMTP/API"** tab (or section)
4. Look for **"Send Mail Token"** section
5. Click the **copy icon** (📋) next to the token to copy it
6. This is your **ZEPTOMAIL_API_TOKEN** - save it securely

**Important Notes:**
- The API token is **unique to each Agent**
- You can use the default token or generate a new one if needed
- The token is also called "Encrypted API Key" or "Send Mail Token"
- Without this token, you'll get a "401 Unauthorised" error when trying to send emails

## Step 3: Configure Environment Variables

Add the following environment variables to your `.env` file in `applyforme_backend`:

```env
# ZeptoMail Configuration
# Token can include the "Zoho-enczapikey" prefix or not - both formats work
ZEPTOMAIL_API_TOKEN=Zoho-enczapikey PHtE6r0EEOi/2m4o8BIF4/65Es6kZtwo9LgyeVNOtIhDCPNSS00Dr9h9kDfiqx8oUfRLQvGfnY48576fuuiBImy+NWZMWWqyqK3sx/VYSPOZsbq6x00bslUedk3aUIXnc9dp0CLSv93bNA==
SENDER_EMAIL=contactus@applyforme.com.au
SENDER_NAME=Apply For Me
```

### Environment Variables Explained

- **ZEPTOMAIL_API_TOKEN** (Required): Your ZeptoMail API token/encrypted API key
- **SENDER_EMAIL** (Optional): Defaults to `contactus@applyforme.com.au` if not set
- **SENDER_NAME** (Optional): Defaults to `Apply For Me` if not set

## Step 4: Test the Integration

After configuring the environment variables, restart your backend server and test email sending:

1. Test password reset email functionality
2. Test job application email functionality
3. Check ZeptoMail dashboard for email delivery status

## Email Functions

The following email functions are available and configured to use ZeptoMail:

1. **`sendPasswordResetEmail(email, resetToken, resetUrl)`** - Sends password reset emails
2. **`sendPasswordResetSuccessEmail(email)`** - Sends password reset confirmation emails
3. **`sendJobApplicationEmail(toEmail, subject, body, attachments)`** - Sends job application emails with attachments

## Troubleshooting

### Error: "ZeptoMail API token is not configured"
- Make sure `ZEPTOMAIL_API_TOKEN` is set in your `.env` file
- Restart your server after adding the environment variable

### Error: "Failed to send email" or "TM_4001 Access Denied"
This error typically means one of the following:

1. **Invalid API Token (SERR_157) - MOST COMMON:**
   - **Check your .env file:** Make sure `ZEPTOMAIL_API_TOKEN` has no extra spaces, quotes, or newlines
   - **Correct format in .env:** `ZEPTOMAIL_API_TOKEN=your_token_here` (no quotes needed)
   - **Wrong format:** `ZEPTOMAIL_API_TOKEN="your_token_here"` or `ZEPTOMAIL_API_TOKEN= your_token_here` (with space)
   - **Copy token correctly:** Go to Agents >> SMTP/API >> Send Mail Token, click copy icon
   - **Token length:** Should be a long string (usually 50+ characters)
   - **Regenerate if needed:** If unsure, generate a new token in ZeptoMail dashboard

2. **Sender address not properly configured:**
   - Verify that `contactus@applyforme.com.au` is added as a sender address in ZeptoMail
   - Make sure it's associated with the correct Agent (the same agent your API token belongs to)
   - Check that the sender address shows as "Verified" in the dashboard

3. **API Token from wrong Agent:**
   - The API token MUST be from the same Agent that has your sender address
   - If you have multiple agents, make sure both are in the same one
   - Check: Agents >> [Your Agent] >> SMTP/API >> Send Mail Token

4. **Domain/Agent mismatch:**
   - Ensure your domain `applyforme.com.au` is verified
   - Verify the sender address is associated with the Agent that has your API token
   - Check that the Agent has access to send from your domain

5. **Check server logs:**
   - The enhanced error logging will show token preview and detailed error information
   - Look for the full error response in your console/logs
   - Check the token length in logs to verify it was loaded correctly

### Emails not being delivered
- Check ZeptoMail dashboard for bounce/spam reports
- Verify DKIM and CNAME records are still valid
- Check sender address status in ZeptoMail

## API Endpoint

The application uses the ZeptoMail API endpoint:
- **URL**: `https://api.zeptomail.in/v1.1/email` (Note: `.in` domain, not `.com`)
- **Method**: POST
- **Authentication**: `Zoho-enczapikey {API_TOKEN}`

**Important:** Your `.env` file can have the token in either format:
- `ZEPTOMAIL_API_TOKEN=Zoho-enczapikey PHtE6r0EEOi/2m4o8BIF4/...` (with prefix)
- `ZEPTOMAIL_API_TOKEN=PHtE6r0EEOi/2m4o8BIF4/...` (without prefix - will be added automatically)

## Bounce Address

The bounce address is configured as `bounce-zem@applyforme.com.au` which corresponds to your verified CNAME record `bounce-zem` pointing to `cluster89.zeptomail.in`.

## Notes

- The old Gmail SMTP configuration has been replaced with ZeptoMail API
- All existing email functionality remains the same - no code changes needed in controllers
- ZeptoMail is specifically designed for transactional emails (password resets, notifications, etc.)
- Your existing `contactus@applyforme.com.au` mailbox can coexist with ZeptoMail - they serve different purposes

## Migration Complete

✅ Email service migrated from Gmail SMTP to ZeptoMail API  
✅ Sender address configured: `contactus@applyforme.com.au`  
✅ All email functions updated to use ZeptoMail  
✅ Attachment support maintained  

