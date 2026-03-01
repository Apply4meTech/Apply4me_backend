# AWS S3 Setup Instructions

This guide will help you set up AWS S3 for file uploads (resume and cover letter).

## Step 1: Create AWS Account (if you don't have one)

1. Go to [AWS Console](https://aws.amazon.com/console/)
2. Sign up for an AWS account (free tier available)
3. Complete the registration process

## Step 2: Create S3 Bucket

1. **Login to AWS Console**
   - Go to https://console.aws.amazon.com/
   - Login with your credentials

2. **Navigate to S3**
   - Search for "S3" in the services search bar
   - Click on "S3" service

3. **Create Bucket**
   - Click "Create bucket" button
   - **Bucket name**: Choose a unique name (e.g., `applyforme-documents-2026`)
     - Note: Bucket names must be globally unique across all AWS accounts
   - **AWS Region**: Select your preferred region (e.g., `us-east-1`, `us-west-2`)
   - **Object Ownership**: Choose "ACLs disabled" (recommended) or "ACLs enabled"
   - **Block Public Access settings**: 
     - For private files: Keep all checkboxes checked (default)
     - For public files: Uncheck "Block all public access" (NOT recommended for resumes)
   - **Bucket Versioning**: Enable if you want to keep file versions (optional)
   - **Default encryption**: Enable (recommended)
     - Choose "SSE-S3" (Amazon S3 managed keys)
   - Click "Create bucket"

## Step 3: Create IAM User for S3 Access

1. **Navigate to IAM**
   - Search for "IAM" in the services search bar
   - Click on "IAM" service

2. **Create User**
   - Click "Users" in the left sidebar
   - Click "Create user"
   - **User name**: `applyforme-s3-user` (or any name you prefer)
   - **Access type**: Select "Programmatic access"
   - Click "Next: Permissions"

3. **Attach Policies**
   - Click "Attach policies directly"
   - Search for "S3" and select:
     - `AmazonS3FullAccess` (for full access)
     - OR create a custom policy with limited permissions (see below)
   - Click "Next: Tags" (optional)
   - Click "Next: Review"
   - Click "Create user"

4. **Save Credentials**
   - **IMPORTANT**: Copy and save these credentials immediately:
     - **Access Key ID**
     - **Secret Access Key**
   - You won't be able to see the Secret Access Key again!
   - Store these securely (we'll add them to `.env` file)

## Step 4: Create Custom IAM Policy (Optional - More Secure)

If you want to limit permissions to only your bucket:

1. In IAM, go to "Policies"
2. Click "Create policy"
3. Click "JSON" tab and paste:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::YOUR-BUCKET-NAME",
        "arn:aws:s3:::YOUR-BUCKET-NAME/*"
      ]
    }
  ]
}
```

4. Replace `YOUR-BUCKET-NAME` with your actual bucket name
5. Click "Next", give it a name like `ApplyForMeS3Policy`
6. Click "Create policy"
7. Attach this policy to your IAM user instead of `AmazonS3FullAccess`

## Step 5: Configure Environment Variables

1. **Add to `.env` file** in your backend directory:

```env
# AWS S3 Configuration
AWS_ACCESS_KEY_ID=your-access-key-id-here
AWS_SECRET_ACCESS_KEY=your-secret-access-key-here
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET_NAME=your-bucket-name-here
```

2. **Replace the values**:
   - `AWS_ACCESS_KEY_ID`: The Access Key ID from Step 3
   - `AWS_SECRET_ACCESS_KEY`: The Secret Access Key from Step 3
   - `AWS_REGION`: **Must match your bucket's region exactly** (e.g. `ap-southeast-2` for Sydney, `us-east-1` for N. Virginia)
   - `AWS_S3_BUCKET_NAME`: Your bucket name from Step 2

## Step 6: Install AWS SDK

Run this command in your backend directory:

```bash
npm install aws-sdk
```

## Step 7: Test the Setup

1. Start your backend server
2. Try uploading a resume through the onboarding form
3. Check your S3 bucket - you should see files in the `resumes/` and `cover-letters/` folders

## Security Best Practices

1. **Never commit `.env` file** to Git
2. **Use IAM roles** instead of access keys in production (if using AWS services)
3. **Enable bucket encryption** (already done in Step 2)
4. **Set up bucket policies** to restrict access if needed
5. **Enable CloudTrail** for audit logging (optional)
6. **Set up lifecycle policies** to automatically delete old files (optional)

## Troubleshooting

### Error: "The request signature we calculated does not match the signature you provided"
This is the most common S3 upload error. Fix in this order:

1. **Region mismatch** (most common cause)
   - Your `AWS_REGION` must match the bucket's actual region
   - Find your bucket region: AWS Console → S3 → your bucket → Properties → AWS Region
   - Or run: `aws s3api get-bucket-location --bucket YOUR-BUCKET-NAME`
   - For Australian deployments (e.g. applyforme.com.au), use `ap-southeast-2` (Sydney)
   - Update `.env`: `AWS_REGION=ap-southeast-2`

2. **Wrong or rotated credentials**
   - Verify Access Key ID and Secret Access Key in IAM
   - Create new credentials if keys were rotated
   - Ensure no extra spaces, quotes, or newlines in `.env` values

3. **Server clock skew**
   - AWS rejects requests if server time is off by >15 minutes
   - Sync time: `w32tm /resync` (Windows) or `sudo ntpdate pool.ntp.org` (Linux)

4. **Restart the server** after any `.env` changes

### Error: "Access Denied"
- Check IAM user has correct permissions
- Verify bucket name in `.env` matches actual bucket name
- Ensure bucket region matches `AWS_REGION` in `.env`

### Error: "Bucket not found"
- Verify bucket name is correct
- Check bucket exists in the specified region
- Ensure bucket name doesn't have typos

### Error: "Invalid credentials"
- Double-check Access Key ID and Secret Access Key
- Ensure no extra spaces in `.env` file
- Restart server after updating `.env`

### Error: "AccessControlListNotSupported" or "Bucket does not allow ACLs"
- New S3 buckets (2023+) have ACLs disabled by default
- Add to `.env`: `AWS_S3_DISABLE_ACL=true`

## File Structure in S3

After uploads, your bucket will have this structure:

```
your-bucket-name/
├── resumes/
│   ├── abc123...-1234567890.pdf
│   └── def456...-1234567891.pdf
└── cover-letters/
    ├── ghi789...-1234567892.pdf
    └── jkl012...-1234567893.pdf
```

## Accessing Files

Files are stored as **private** by default. To access them:

1. Use **signed URLs** (valid for 1 hour) - already implemented in `s3Service.js`
2. Make bucket public (NOT recommended for resumes)
3. Use AWS CloudFront for CDN access (advanced)

The API will return the S3 URL, but you may need to generate signed URLs for private access.
