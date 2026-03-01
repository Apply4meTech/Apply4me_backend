const { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const { getSignedUrl: createPresignedUrl } = require('@aws-sdk/s3-request-presigner');
const crypto = require('crypto');

// Trim credentials to avoid signature mismatch from accidental spaces
const accessKeyId = (process.env.AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID || '').trim();
const secretAccessKey = (process.env.AWS_SECRET_ACCESS_KEY || '').trim();
// Region MUST match your S3 bucket's region (e.g. ap-southeast-2 for Sydney, us-east-1 for N. Virginia)
const region = (process.env.AWS_REGION_NAME || process.env.AWS_REGION || 'us-east-1').trim() || 'us-east-1';

// Configure AWS S3 client (v3 - better signature handling, fixes EC2 issues)
const s3Client = new S3Client({
  region,
  ...(accessKeyId && secretAccessKey && {
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  }),
  ...(process.env.AWS_S3_ENDPOINT && {
    endpoint: process.env.AWS_S3_ENDPOINT,
    forcePathStyle: process.env.AWS_S3_FORCE_PATH_STYLE === 'true',
  }),
});

const BUCKET_NAME = process.env.AWS_RESUME_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME;

// Validate required environment variables
if (!accessKeyId) {
  console.error('❌ AWS_ACCESS_KEY or AWS_ACCESS_KEY_ID is required');
}

if (!secretAccessKey) {
  console.error('❌ AWS_SECRET_ACCESS_KEY is required');
}

if (!BUCKET_NAME) {
  console.error('❌ AWS_RESUME_BUCKET_NAME or AWS_S3_BUCKET_NAME is required');
}

// Log S3 config at startup (helps debug EC2/deployment issues)
if (accessKeyId && BUCKET_NAME) {
  console.log(`📦 S3 configured: region=${region}, bucket=${BUCKET_NAME} (SDK v3)`);
}

/**
 * Upload file to S3
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} fileName - Original file name
 * @param {String} mimeType - File MIME type
 * @param {String} folder - Folder path in S3 (e.g., 'resumes', 'cover-letters')
 * @returns {Promise<Object>} - Returns { url, key, resourceId }
 */
const uploadFileToS3 = async (fileBuffer, fileName, mimeType, folder = 'documents') => {
  try {
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${crypto.randomBytes(16).toString('hex')}-${Date.now()}.${fileExtension}`;
    const key = `${folder}/${uniqueFileName}`;

    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ...(process.env.AWS_S3_DISABLE_ACL !== 'true' && { ACL: 'private' }),
    };

    const upload = new Upload({
      client: s3Client,
      params: uploadParams,
    });

    const result = await upload.done();
    const location = result.Location || `https://${BUCKET_NAME}.s3.${region}.amazonaws.com/${key}`;

    return {
      fileName,
      fileSize: fileBuffer.length,
      resourceId: key,
      url: location,
      key,
      bucket: BUCKET_NAME,
      mimeType,
      uploadedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
};

/**
 * Delete file from S3
 * @param {String} key - S3 object key
 * @returns {Promise<Object>}
 */
const deleteFileFromS3 = async (key) => {
  try {
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
    return { success: true };
  } catch (error) {
    console.error('Error deleting file from S3:', error);
    throw new Error(`Failed to delete file from S3: ${error.message}`);
  }
};

/**
 * Get signed URL for private file access (valid for 1 hour)
 * @param {String} key - S3 object key
 * @param {Number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {String} - Signed URL
 */
const getSignedUrlForGet = async (key, expiresIn = 3600) => {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
    });
    return await createPresignedUrl(s3Client, command, { expiresIn });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

/**
 * Get file buffer from S3 by key (for processing e.g. resume customization)
 * @param {String} key - S3 object key
 * @returns {Promise<Buffer>} - File buffer
 */
const getFileBufferFromS3 = async (key) => {
  try {
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
    const chunks = [];
    for await (const chunk of result.Body) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  } catch (error) {
    console.error('Error getting file from S3:', error);
    throw new Error(`Failed to get file from S3: ${error.message}`);
  }
};

// Alias for backward compatibility
const getSignedUrlExport = getSignedUrlForGet;

module.exports = {
  uploadFileToS3,
  deleteFileFromS3,
  getSignedUrl: getSignedUrlExport,
  getFileBufferFromS3,
};
