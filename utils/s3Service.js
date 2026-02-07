const AWS = require('aws-sdk');
const crypto = require('crypto');

// Configure AWS S3
// Support both naming conventions for flexibility
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY || process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION_NAME || process.env.AWS_REGION || 'us-east-1',
});

const BUCKET_NAME = process.env.AWS_RESUME_BUCKET_NAME || process.env.AWS_S3_BUCKET_NAME;

// Validate required environment variables
if (!s3.config.credentials.accessKeyId) {
  console.error('❌ AWS_ACCESS_KEY or AWS_ACCESS_KEY_ID is required');
}

if (!s3.config.credentials.secretAccessKey) {
  console.error('❌ AWS_SECRET_ACCESS_KEY is required');
}

if (!BUCKET_NAME) {
  console.error('❌ AWS_RESUME_BUCKET_NAME or AWS_S3_BUCKET_NAME is required');
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
    // Generate unique file name to avoid conflicts
    const fileExtension = fileName.split('.').pop();
    const uniqueFileName = `${crypto.randomBytes(16).toString('hex')}-${Date.now()}.${fileExtension}`;
    const key = `${folder}/${uniqueFileName}`;

    // Upload parameters
    const uploadParams = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
      ACL: 'private', // Set to 'public-read' if you want public access
    };

    // Upload to S3
    const result = await s3.upload(uploadParams).promise();

    // Generate resource ID (you can use the S3 key or generate your own)
    const resourceId = result.Key;

    return {
      fileName: fileName,
      fileSize: fileBuffer.length,
      resourceId: resourceId,
      url: result.Location,
      key: result.Key,
      bucket: result.Bucket,
      mimeType: mimeType,
      uploadedAt: new Date().toISOString()
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
    const deleteParams = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    await s3.deleteObject(deleteParams).promise();
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
const getSignedUrl = async (key, expiresIn = 3600) => {
  try {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Expires: expiresIn,
    };

    return await s3.getSignedUrlPromise('getObject', params);
  } catch (error) {
    console.error('Error generating signed URL:', error);
    throw new Error(`Failed to generate signed URL: ${error.message}`);
  }
};

module.exports = {
  uploadFileToS3,
  deleteFileFromS3,
  getSignedUrl,
};
