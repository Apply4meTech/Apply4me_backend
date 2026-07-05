const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Service');
const User = require('../models/User');
const { runPostUploadResumePipeline, isAtsEligible } = require('../utils/resumePipeline');

const VALID_UPLOAD_TYPES = ['resume', 'cv', 'academic_transcripts', 'certifications', 'visa_attachment'];
const TYPE_TO_FIELD = {
  resume: 'resume_details',
  cv: 'cv_details',
  academic_transcripts: 'academicTranscripts_details',
  certifications: 'certifications_details',
  visa_attachment: 'visaAttachment_details'
};
const TYPE_TO_FOLDER = {
  resume: 'resumes',
  cv: 'cover-letters',
  academic_transcripts: 'academic-transcripts',
  certifications: 'certifications',
  visa_attachment: 'visa-attachments'
};

/**
 * Replace the customer's profile resume (same behavior as POST /api/upload/resume).
 * Used by authenticated user upload and by employee Fill Data modal.
 * @param {string} userId
 * @param {{ buffer: Buffer, originalname: string, mimetype: string }} file
 */
async function applyResumeUploadForUserId(userId, file) {
  const user = await User.findById(userId);
  if (!user) {
    const err = new Error('User not found');
    err.statusCode = 404;
    throw err;
  }

  const existingDetails = user.resume_details;
  if (existingDetails && existingDetails.key) {
    try {
      await deleteFileFromS3(existingDetails.key);
    } catch (error) {
      console.error('Error deleting old resume:', error);
    }
  }

  if (user.atsReport) {
    const optKey =
      user.atsReport.optimizedResumeKey || user.atsReport.optimizedResumeDetails?.key;
    if (optKey) {
      try {
        await deleteFileFromS3(optKey);
      } catch (error) {
        console.error('Error deleting old optimized resume from S3:', error);
      }
    }
  }

  const uploadResult = await uploadFileToS3(
    file.buffer,
    file.originalname,
    file.mimetype,
    'resumes'
  );

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

  await User.findByIdAndUpdate(userId, {
    $set: { resume_details: fileDetails },
    $unset: { atsReport: 1 }
  });
  setImmediate(() => runPostUploadResumePipeline(userId));

  const userAfter = await User.findById(userId).select('subscription.planName purchasedAddons');
  const eligibleAts = userAfter && isAtsEligible(userAfter);

  const message = eligibleAts
    ? 'Resume uploaded. ATS analysis and ATS-friendly PDF are generating in the background (may take a minute).'
    : 'Resume uploaded successfully. This plan uses the uploaded file as-is.';

  return {
    fileDetails,
    eligibleAts,
    message
  };
}

/**
 * Upload file to S3 (Resume, CV, Academic Transcripts, Certifications)
 * POST /api/upload/resume | /api/upload/cv | /api/upload/academic_transcripts | /api/upload/certifications
 */
const uploadFile = async (req, res) => {
  try {
    const userId = req.userId;
    const fileType = (req.params.type || '').toLowerCase();
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    if (!VALID_UPLOAD_TYPES.includes(fileType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Use "resume", "cv", "academic_transcripts", "certifications", or "visa_attachment"'
      });
    }

    if (fileType === 'resume') {
      const { fileDetails, eligibleAts, message } = await applyResumeUploadForUserId(userId, req.file);
      return res.json({
        success: true,
        message,
        fileDetails,
        atsPipelineInProgress: !!eligibleAts,
        atsNotIncluded: !eligibleAts
      });
    }

    const user = await User.findById(userId);
    const updateField = TYPE_TO_FIELD[fileType];
    const existingDetails = user[updateField];

    if (existingDetails && existingDetails.key) {
      try {
        await deleteFileFromS3(existingDetails.key);
      } catch (error) {
        console.error(`Error deleting old ${fileType}:`, error);
      }
    }

    const folder = TYPE_TO_FOLDER[fileType];
    const uploadResult = await uploadFileToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
      folder
    );

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

    await User.findByIdAndUpdate(userId, {
      [updateField]: fileDetails
    });

    res.json({
      success: true,
      message: `${fileType} uploaded successfully`,
      fileDetails
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
 */
const deleteFile = async (req, res) => {
  try {
    const userId = req.userId;
    const fileType = (req.params.type || '').toLowerCase();

    if (!VALID_UPLOAD_TYPES.includes(fileType)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file type. Use "resume", "cv", "academic_transcripts", "certifications", or "visa_attachment"'
      });
    }

    const user = await User.findById(userId);
    const updateField = TYPE_TO_FIELD[fileType];
    const fileDetails = user[updateField];

    if (!fileDetails || !fileDetails.key) {
      return res.status(404).json({
        success: false,
        error: `${fileType.replace('_', ' ')} not found`
      });
    }

    try {
      await deleteFileFromS3(fileDetails.key);
    } catch (error) {
      console.error('Error deleting file from S3:', error);
    }

    const unsetPayload = { [updateField]: 1 };
    if (fileType === 'resume') {
      unsetPayload.atsReport = 1;
    }

    await User.findByIdAndUpdate(userId, {
      $unset: unsetPayload
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
 */
const getFileUrl = async (req, res) => {
  try {
    const userId = req.userId;
    const fileType = (req.params.type || '').toLowerCase();

    if (!VALID_UPLOAD_TYPES.includes(fileType)) {
      return res.status(400).json({ success: false, error: 'Invalid file type' });
    }

    const user = await User.findById(userId);
    const fileDetails = user[TYPE_TO_FIELD[fileType]];

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
  getFileUrl,
  applyResumeUploadForUserId
};
