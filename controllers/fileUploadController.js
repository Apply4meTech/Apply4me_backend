const { uploadFileToS3, deleteFileFromS3, getFileBufferFromS3 } = require('../utils/s3Service');
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

    // If resume is uploaded, trigger ATS analysis asynchronously (don't wait for it)
    if (fileType === 'resume') {
      // Trigger analysis in background (don't block response)
      setImmediate(async () => {
        try {
          // Import the analysis utilities directly to avoid circular dependencies
          const { extractResumeText, parseResumeStructure } = require('../utils/resumeExtractor');
          const { analyzeATS } = require('../utils/atsAnalyzer');

          // Get updated user
          const updatedUser = await User.findById(userId);
          if (!updatedUser || !updatedUser.resume_details || !updatedUser.resume_details.key) {
            return;
          }

          // Check if analysis already exists and is recent (within 24 hours)
          if (updatedUser.atsReport && updatedUser.atsReport.analyzedAt) {
            const hoursSinceAnalysis = (Date.now() - new Date(updatedUser.atsReport.analyzedAt).getTime()) / (1000 * 60 * 60);
            if (hoursSinceAnalysis < 24 && updatedUser.atsReport.originalResumeKey === updatedUser.resume_details.key) {
              return;
            }
          }

          // Get resume file from S3
          const fileBuffer = await getFileBufferFromS3(updatedUser.resume_details.key);
          
          // Extract text from resume
          const resumeText = await extractResumeText(fileBuffer, updatedUser.resume_details.mimeType);
          
          // Parse resume structure
          const resumeStructure = parseResumeStructure(resumeText);

          // Analyze with OpenAI
          const analysisResult = await analyzeATS(resumeText, resumeStructure);

          // Save analysis to user
          const atsReport = {
            score: analysisResult.score,
            analyzedAt: new Date(),
            summary: analysisResult.summary || 'ATS analysis completed',
            recommendations: analysisResult.recommendations || [],
            strengths: analysisResult.strengths || [],
            weaknesses: analysisResult.weaknesses || [],
            originalResumeKey: updatedUser.resume_details.key
          };

          await User.findByIdAndUpdate(userId, {
            atsReport: atsReport
          });

          console.log(`✅ ATS analysis completed for user ${userId} - Score: ${analysisResult.score}`);
        } catch (error) {
          console.error(`❌ Error in background ATS analysis for user ${userId}:`, error);
          // Don't throw - this is background processing
        }
      });
    }

    // Return file details
    res.json({
      success: true,
      message: `${fileType === 'resume' ? 'Resume' : 'CV'} uploaded successfully`,
      fileDetails: fileDetails,
      ...(fileType === 'resume' ? { 
        atsAnalysisInProgress: true,
        message: 'Resume uploaded successfully. ATS analysis in progress...'
      } : {})
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
