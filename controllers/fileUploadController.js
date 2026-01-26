const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Service');
const User = require('../models/User');

/**
 * Upload file to S3 (Resume or CV)
 * POST /api/upload/resume or /api/upload/cv
 */
const uploadFile = async (req, res) => {
  try {
    const userId = req.userId;
    const fileType = req.params.type; // 'resume' or 'cv'
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    // Validate file type
    if (fileType !== 'resume' && fileType !== 'cv') {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Use "resume" or "cv"'
      });
    }

    // Get user to check for existing file
    const user = await User.findById(userId);
    
    // Delete old file from S3 if exists
    if (fileType === 'resume' && user.resume_details && user.resume_details.key) {
      try {
        await deleteFileFromS3(user.resume_details.key);
      } catch (error) {
        console.error('Error deleting old resume:', error);
        // Continue even if deletion fails
      }
    } else if (fileType === 'cv' && user.cv_details && user.cv_details.key) {
      try {
        await deleteFileFromS3(user.cv_details.key);
      } catch (error) {
        console.error('Error deleting old CV:', error);
        // Continue even if deletion fails
      }
    }

    // Upload to S3
    const folder = fileType === 'resume' ? 'resumes' : 'cover-letters';
    const uploadResult = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folder
    );

    // Prepare file details object (matching the structure from s3Service)
    const fileDetails = {
      fileName: uploadResult.fileName,
      fileSize: uploadResult.fileSize,
      resourceId: uploadResult.resourceId,
      url: uploadResult.url,
      key: uploadResult.key,
      bucket: uploadResult.bucket,
      mimeType: uploadResult.mimeType,
      uploadedAt: uploadResult.uploadedAt || new Date()
    };

    // Save to database immediately
    const updateField = fileType === 'resume' ? 'resume_details' : 'cv_details';
    await User.findByIdAndUpdate(userId, {
      [updateField]: fileDetails
    });

    // Return file details
    res.json({
      success: true,
      message: `${fileType === 'resume' ? 'Resume' : 'CV'} uploaded successfully`,
      fileDetails: fileDetails
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      details: error.message
    });
  }
};

/**
 * Delete file from S3 and database
 * DELETE /api/upload/resume or /api/upload/cv
 */
const deleteFile = async (req, res) => {
  try {
    const userId = req.userId;
    const fileType = req.params.type; // 'resume' or 'cv'
    
    if (fileType !== 'resume' && fileType !== 'cv') {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Use "resume" or "cv"'
      });
    }

    const user = await User.findById(userId);
    const fileDetails = fileType === 'resume' ? user.resume_details : user.cv_details;

    if (!fileDetails || !fileDetails.key) {
      return res.status(404).json({
        success: false,
        error: `${fileType === 'resume' ? 'Resume' : 'CV'} not found`
      });
    }

    // Delete from S3
    try {
      await deleteFileFromS3(fileDetails.key);
    } catch (error) {
      console.error('Error deleting file from S3:', error);
      // Continue to delete from database even if S3 deletion fails
    }

    // Delete from database
    const updateField = fileType === 'resume' ? 'resume_details' : 'cv_details';
    await User.findByIdAndUpdate(userId, {
      $unset: { [updateField]: 1 }
    });

    res.json({
      success: true,
      message: `${fileType === 'resume' ? 'Resume' : 'CV'} deleted successfully`
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete file',
      details: error.message
    });
  }
};

/**
 * Get signed URL for file access
 * GET /api/upload/resume/url or /api/upload/cv/url
 */
const getFileUrl = async (req, res) => {
  try {
    const userId = req.userId;
    const fileType = req.params.type; // 'resume' or 'cv'
    
    const user = await User.findById(userId);
    const fileDetails = fileType === 'resume' ? user.resume_details : user.cv_details;

    if (!fileDetails || !fileDetails.key) {
      return res.status(404).json({
        success: false,
        error: `${fileType === 'resume' ? 'Resume' : 'CV'} not found`
      });
    }

    // Return the URL (or generate signed URL if needed)
    res.json({
      success: true,
      url: fileDetails.url,
      fileName: fileDetails.fileName
    });
  } catch (error) {
    console.error('Error getting file URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get file URL',
      details: error.message
    });
  }
};

module.exports = {
  uploadFile,
  deleteFile,
  getFileUrl
};
