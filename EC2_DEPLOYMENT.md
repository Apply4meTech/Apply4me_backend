# EC2 Deployment Checklist

## Fix S3 "SignatureDoesNotMatch" Error

The app now uses **AWS SDK v3** (`@aws-sdk/client-s3`) which has better signature handling and often fixes EC2 issues that worked locally with v2.

### After pulling/deploying

```bash
cd /home/ubuntu/Apply4me_backend
npm install
pm2 restart server
```

If you still see "signature does not match" in logs:

### 1. Add/Update .env on EC2

SSH into your EC2 instance and ensure `/home/ubuntu/Apply4me_backend/.env` contains:

```env
# AWS S3 - REQUIRED for resume/CV uploads
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET_NAME=your-bucket-name
```

**Critical:** `AWS_REGION` must match your bucket's region exactly.
- Australian buckets: `ap-southeast-2` (Sydney)
- US East: `us-east-1`
- Find yours: AWS Console → S3 → your bucket → Properties → AWS Region

### 2. Verify .env is Loaded

PM2 runs from the project directory. Ensure:
- `.env` exists at `/home/ubuntu/Apply4me_backend/.env`
- No spaces around `=` in .env (e.g. `AWS_REGION=ap-southeast-2` not `AWS_REGION = ap-southeast-2`)

### 3. Restart PM2

```bash
cd /home/ubuntu/Apply4me_backend
pm2 restart server
# or
pm2 restart all
```

### 4. Check Startup Logs

After restart, you should see:
```
📦 S3 configured: region=ap-southeast-2, bucket=your-bucket-name (SDK v3)
```

### 5. Run S3 diagnostic (if still failing)

```bash
cd /home/ubuntu/Apply4me_backend
node scripts/test-s3-connection.js
```

This checks credentials and reports if the bucket region doesn't match your `AWS_REGION`.

If you don't see this line, the .env may not be loading. Check:
- PM2 is started from the backend directory
- `require('dotenv').config()` runs before any S3 code

### 6. Alternative: Set Env in PM2 Ecosystem

Create `ecosystem.config.js` in the backend folder:

```javascript
module.exports = {
  apps: [{
    name: 'server',
    script: 'server.js',
    cwd: '/home/ubuntu/Apply4me_backend',
    env: {
      AWS_REGION: 'ap-southeast-2',
      AWS_ACCESS_KEY_ID: 'your-key',
      AWS_SECRET_ACCESS_KEY: 'your-secret',
      AWS_S3_BUCKET_NAME: 'your-bucket',
      // ... other vars from .env
    }
  }]
};
```

Then: `pm2 start ecosystem.config.js`
