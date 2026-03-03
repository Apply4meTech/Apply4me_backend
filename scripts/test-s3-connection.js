#!/usr/bin/env node
/**
 * Run on EC2 to diagnose S3: node scripts/test-s3-connection.js
 * Tries multiple regions to find which one works for your bucket.
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const { S3Client, ListObjectsV2Command, GetBucketLocationCommand } = require('@aws-sdk/client-s3');

const accessKeyId = (process.env.AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '').trim();
const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
const configuredRegion = (process.env.AWS_REGION_NAME || process.env.AWS_REGION || 'us-east-1').trim();
const bucket = process.env.AWS_RESUME_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME;

console.log('=== S3 Connection Test ===');
console.log('Access Key ID length:', accessKeyId ? accessKeyId.length : 0);
console.log('Secret Key length:', secretAccessKey ? secretAccessKey.length : 0);
console.log('Configured region:', configuredRegion);
console.log('Bucket:', bucket);
console.log('Server time:', new Date().toISOString());

if (!accessKeyId || !secretAccessKey || !bucket) {
  console.error('❌ Missing credentials or bucket. Check .env');
  process.exit(1);
}

function createClient(region) {
  return new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
}

async function testRegion(region) {
  const client = createClient(region);
  await client.send(new ListObjectsV2Command({ Bucket: bucket, MaxKeys: 1 }));
  return true;
}

async function getBucketRegion() {
  const client = createClient('us-east-1');
  const result = await client.send(new GetBucketLocationCommand({ Bucket: bucket }));
  return result.LocationConstraint || 'us-east-1';
}

async function run() {
  // Try configured region first
  console.log('\nTrying configured region:', configuredRegion);
  try {
    await testRegion(configuredRegion);
    console.log('✅ S3 connection OK with region', configuredRegion);
    return;
  } catch (err) {
    console.log('   Failed:', err.code || err.message);
  }

  // Try us-east-1 (many buckets default here)
  if (configuredRegion !== 'us-east-1') {
    console.log('\nTrying us-east-1...');
    try {
      await testRegion('us-east-1');
      console.log('✅ S3 connection OK with us-east-1');
      console.log('\n⚠️  FIX: Your bucket is in us-east-1. Add to .env:');
      console.log('   AWS_REGION=us-east-1');
      console.log('   Then: pm2 restart server');
      return;
    } catch (err) {
      console.log('   Failed:', err.code || err.message);
    }
  }

  // Try ap-southeast-2
  if (configuredRegion !== 'ap-southeast-2') {
    console.log('\nTrying ap-southeast-2...');
    try {
      await testRegion('ap-southeast-2');
      console.log('✅ S3 connection OK with ap-southeast-2');
      console.log('\n⚠️  FIX: Your bucket is in ap-southeast-2. Add to .env:');
      console.log('   AWS_REGION=ap-southeast-2');
      console.log('   Then: pm2 restart server');
      return;
    } catch (err) {
      console.log('   Failed:', err.code || err.message);
    }
  }

  // All failed - likely wrong credentials
  console.error('\n❌ All regions failed. Likely credential issue.');
  console.log('\nChecks:');
  console.log('1. Re-copy AWS_SECRET_ACCESS_KEY from IAM (create new key if rotated)');
  console.log('2. Ensure no spaces/newlines in .env - use: AWS_SECRET_ACCESS_KEY=yourkey');
  console.log('3. If EC2 has IAM role: detach it or ensure .env credentials are correct');
  console.log('4. Verify bucket region in AWS Console → S3 →', bucket, '→ Properties');
  process.exit(1);
}

run();
