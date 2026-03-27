const { uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Service');
const User = require('../models/User');
const { runPostUploadResumePipeline, isAtsEligible } = require('../utils/resumePipeline');

const VALID_UPLOAD_TYPES = ['resume', 'cv', 'academic_transcripts', 'certifications'];
const TYPE_TO_FIELD = {
  resume: 'resume_details',
  cv: 'cv_details',
  academic_transcripts: 'academicTranscripts_details',
  certifications: 'certifications_details'
};
const TYPE_TO_FOLDER = {
  resume: 'resumes',
  cv: 'cover-letters',
  academic_transcripts: 'academic-transcripts',
  certifications: 'certifications'
};

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
        error: 'Invalid file type. Use "resume", "cv", "academic_transcripts", or "certifications"'
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
    await User.findByIdAndUpdate(userId, {
      [updateField]: fileDetails
    });

    // Resume: Starter (no addon) clears ATS; Standard+ / addon runs full ATS + PDF in background
    if (fileType === 'resume') {
      setImmediate(() => runPostUploadResumePipeline(userId));
    }

    const userAfter = await User.findById(userId).select('subscription.planName purchasedAddons');
    const eligibleAts = userAfter && isAtsEligible(userAfter);

    const responseMessage =
      fileType === 'resume'
        ? eligibleAts
          ? 'Resume uploaded. ATS analysis and ATS-friendly PDF are generating in the background (may take a minute).'
          : 'Resume uploaded successfully. Your plan uses your uploaded file as-is.'
        : `${fileType === 'resume' ? 'Resume' : 'CV'} uploaded successfully`;

    res.json({
      success: true,
      message: responseMessage,
      fileDetails,
      ...(fileType === 'resume'
        ? {
            atsPipelineInProgress: !!eligibleAts,
            atsNotIncluded: !eligibleAts
          }
        : {})
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
        error: 'Invalid file type. Use "resume", "cv", "academic_transcripts", or "certifications"'
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
  getFileUrl
};
