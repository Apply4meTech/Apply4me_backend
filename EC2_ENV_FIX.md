# EC2 .env Fix - Remove Duplicate AWS Credentials

## Problem
You have **duplicate AWS credentials** in .env. The last `AWS_SECRET_ACCESS_KEY` overwrites the first, but the code uses `AWS_ACCESS_KEY` (first block) for the access key. Result: **mismatched key pair** → SignatureDoesNotMatch.

## Fix
Edit `/home/ubuntu/Apply4me_backend/.env` and keep **only ONE set** of AWS variables.

### Option A: Use the first pair (AWS_ACCESS_KEY)
```env
AWS_ACCESS_KEY_ID=AKIA4Z7B4Y4KZK4WJWSA
AWS_SECRET_ACCESS_KEY=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
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET_NAME=apply4me-files
```
Remove: `AWS_ACCESS_KEY`, the second `AWS_ACCESS_KEY_ID`, second `AWS_SECRET_ACCESS_KEY`, `AWS_REGION_NAME`, `AWS_RESUME_BUCKET_NAME`

### Option B: Use the second pair (AWS_ACCESS_KEY_ID)
```env
AWS_ACCESS_KEY_ID=AKIA4Z7B4Y4KUBBR4MSL
AWS_SECRET_ACCESS_KEY=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
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET_NAME=apply4me-files
```
Remove: `AWS_ACCESS_KEY`, `AWS_REGION_NAME`, `AWS_RESUME_BUCKET_NAME`, and the first `AWS_SECRET_ACCESS_KEY`

## Recommended .env (no duplicates)
```env
MONGODB_URI=mongodb+srv://aryansingla_db_user:IHwAOm0XWDqQgJ6t@apply4me.eusmu1o.mongodb.net/apply4medb
JWT_SECRET=Applyieureiheuifh47564rtuierfhjkjkghkasjgh
JWT_EXPIRES_IN=30d
FRONTEND_URL=https://applyforme.com.au

# AWS S3 - use ONE pair only
AWS_ACCESS_KEY_ID=AKIA4Z7B4Y4KZK4WJWSA
AWS_SECRET_ACCESS_KEY=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
AWS_REGION=ap-southeast-2
AWS_S3_BUCKET_NAME=apply4me-files

RAZORPAY_KEY_ID=...
RAZORPAY_KEY_SECRET=...
STRIPE_SECRET_KEY=...
OPENAI_API_KEY=...
```

## After editing
```bash
pm2 restart server
```
