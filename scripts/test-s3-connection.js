#!/usr/bin/env node
/**
 * Run on EC2 to diagnose S3 connection: node scripts/test-s3-connection.js
 * Do NOT commit credentials - this script only logs config presence, not values.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const accessKeyId = (process.env.AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '').trim();
const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
const region = (process.env.AWS_REGION_NAME || process.env.AWS_REGION || 'us-east-1').trim();
const bucket = process.env.AWS_RESUME_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME;

console.log('=== S3 Connection Test ===');
console.log('Access Key ID length:', accessKeyId ? accessKeyId.length : 0);
console.log('Secret Key length:', secretAccessKey ? secretAccessKey.length : 0);
console.log('Region:', region);
console.log('Bucket:', bucket);
console.log('Server time:', new Date().toISOString());

if (!accessKeyId || !secretAccessKey || !bucket) {
  console.error('❌ Missing credentials or bucket. Check .env');
  process.exit(1);
}

const AWS = require('aws-sdk');
const s3 = new AWS.S3({
  accessKeyId,
  secretAccessKey,
  region,
  signatureVersion: 'v4',
});

// First get bucket's actual region (works with any region config)
const getBucketRegion = () => {
  const s3Any = new AWS.S3({
    accessKeyId,
    secretAccessKey,
    region: 'us-east-1', // getBucketLocation uses us-east-1
    signatureVersion: 'v4',
  });
  return s3Any.getBucketLocation({ Bucket: bucket }).promise();
};

getBucketRegion()
  .then((data) => {
    const bucketRegion = data.LocationConstraint || 'us-east-1';
    console.log('Bucket actual region:', bucketRegion);
    if (bucketRegion !== region) {
      console.log('⚠️  MISMATCH! Your AWS_REGION=' + region + ' but bucket is in ' + bucketRegion);
      console.log('   Fix: Set AWS_REGION=' + bucketRegion + ' in .env and restart');
    }
  })
  .catch((e) => console.log('Could not get bucket region:', e.code || e.message));

// Test: list bucket (minimal permission)
s3.listObjectsV2({ Bucket: bucket, MaxKeys: 1 })
  .promise()
  .then(() => console.log('✅ S3 connection OK'))
  .catch((err) => {
    console.error('❌ S3 connection failed:', err.code, err.message);
    if (err.code === 'SignatureDoesNotMatch') {
      console.log('\nPossible fixes:');
      console.log('1. Verify bucket region: AWS Console → S3 →', bucket, '→ Properties → AWS Region');
      console.log('2. Set AWS_REGION to match (e.g. us-east-1 or ap-southeast-2)');
      console.log('3. Re-copy AWS_SECRET_ACCESS_KEY - no spaces, newlines, or truncation');
      console.log('4. If EC2 has IAM role: remove it or ensure .env credentials are used');
      console.log('5. Check server time: sudo ntpdate pool.ntp.org');
    }
    process.exit(1);
  });
