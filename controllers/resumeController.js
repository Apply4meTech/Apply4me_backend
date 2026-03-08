const User = require('../models/User');
const { extractResumeText, parseResumeStructure } = require('../utils/resumeExtractor');
const { analyzeATS } = require('../utils/atsAnalyzer');
const { optimizeResumeContent } = require('../utils/resumeOptimizer');
const { generateATSFriendlyPDF, formatResumeText } = require('../utils/pdfGenerator');
const { uploadFileToS3, getSignedUrl, getFileBufferFromS3 } = require('../utils/s3Service');

/**
 * Analyze resume for ATS compatibility
 * POST /api/resume/analyze
 * Query param: force=true to force re-analysis
 */
const analyzeResume = async (req, res) => {
  try {
    const userId = req.userId;
    const forceReanalysis = req.query.force === 'true';
    const user = await User.findById(userId);

    if (!user || !user.resume_details || !user.resume_details.key) {
      return res.status(404).json({
        success: false,
        error: 'Resume not found. Please upload a resume first.'
      });
    }

    // Check if analysis already exists and is recent (within 24 hours) - unless forced
    if (!forceReanalysis && user.atsReport && user.atsReport.analyzedAt) {
      const hoursSinceAnalysis = (Date.now() - new Date(user.atsReport.analyzedAt).getTime()) / (1000 * 60 * 60);
      // Also check if report has actual data (not just empty structure)
      const hasValidData = user.atsReport.score !== null && user.atsReport.score !== undefined;
      
      if (hoursSinceAnalysis < 24 && user.atsReport.originalResumeKey === user.resume_details.key && hasValidData) {
        return res.json({
          success: true,
          message: 'Using cached ATS analysis',
          report: user.atsReport
        });
      }
    }

    // Get resume file from S3
    const fileBuffer = await getFileBufferFromS3(user.resume_details.key);
    
    // Extract text from resume
    const resumeText = await extractResumeText(fileBuffer, user.resume_details.mimeType);
    
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
      originalResumeKey: user.resume_details.key
    };

    await User.findByIdAndUpdate(userId, {
      atsReport: atsReport
    });

    res.json({
      success: true,
      message: 'Resume analyzed successfully',
      report: atsReport
    });
  } catch (error) {
    console.error('Error analyzing resume:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to analyze resume',
      details: error.message
    });
  }
};

/**
 * Get ATS report for user's resume
 * GET /api/resume/report
 */
const getATSReport = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    // Check if report exists and has valid data
    const hasValidReport = user?.atsReport && 
                          user.atsReport.score !== null && 
                          user.atsReport.score !== undefined;

    if (!hasValidReport) {
      // If resume exists but no valid report, suggest analyzing
      if (user?.resume_details?.key) {
        return res.status(404).json({
          success: false,
          error: 'No valid ATS report found. Please analyze your resume.',
          canAnalyze: true
        });
      }
      
      return res.status(404).json({
        success: false,
        error: 'No ATS report found. Please upload and analyze your resume first.'
      });
    }

    res.json({
      success: true,
      report: user.atsReport
    });
  } catch (error) {
    console.error('Error getting ATS report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get ATS report',
      details: error.message
    });
  }
};

/**
 * Optimize resume using AI and generate ATS-friendly PDF
 * POST /api/resume/optimize
 */
const ATS_PLANS = ['Standard', 'Pro', 'Premium'];

const optimizeResume = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user || !user.resume_details || !user.resume_details.key) {
      return res.status(404).json({
        success: false,
        error: 'Resume not found. Please upload a resume first.'
      });
    }

    if (!user.atsReport || !user.atsReport.score) {
      return res.status(400).json({
        success: false,
        error: 'Please analyze your resume first before optimizing.'
      });
    }

    const hasATSPlan = ATS_PLANS.includes(user.subscription?.planName);
    const hasResumeAddon = user.purchasedAddons?.some(a => a.name === 'resume_rewrite');
    if (!hasATSPlan && !hasResumeAddon) {
      return res.status(403).json({
        success: false,
        error: 'ATS resume optimization requires Standard, Pro, or Premium plan, or the Custom Resume Rewrite add-on.'
      });
    }

    // Get resume file from S3
    const fileBuffer = await getFileBufferFromS3(user.resume_details.key);
    
    // Extract text from resume
    const resumeText = await extractResumeText(fileBuffer, user.resume_details.mimeType);

    // Optimize resume content using AI
    const optimizedText = await optimizeResumeContent(resumeText, user.atsReport);

    // Format text for PDF generation
    const formattedText = formatResumeText(optimizedText);

    // Generate ATS-friendly PDF
    const pdfBuffer = await generateATSFriendlyPDF(formattedText);

    // Upload optimized PDF to S3
    const fileName = `optimized_${user.resume_details.fileName.replace(/\.[^/.]+$/, '')}.pdf`;
    const uploadResult = await uploadFileToS3(
      pdfBuffer,
      fileName,
      'application/pdf',
      'resumes/optimized'
    );

    // Re-analyze optimized resume to get new score
    const optimizedStructure = parseResumeStructure(formattedText);
    const optimizedAnalysis = await analyzeATS(formattedText, optimizedStructure);

    // Update user with optimized resume details
    const updatedAtsReport = {
      ...user.atsReport.toObject(),
      optimizedResumeKey: uploadResult.key,
      optimizedResumeDetails: {
        fileName: fileName,
        fileSize: uploadResult.fileSize,
        resourceId: uploadResult.resourceId,
        url: uploadResult.url,
        key: uploadResult.key,
        bucket: uploadResult.bucket,
        mimeType: uploadResult.mimeType,
        uploadedAt: uploadResult.uploadedAt || new Date()
      },
      optimizedAt: new Date(),
      optimizationScore: optimizedAnalysis.score
    };

    await User.findByIdAndUpdate(userId, {
      atsReport: updatedAtsReport
    });

    res.json({
      success: true,
      message: 'Resume optimized successfully',
      optimizedResume: {
        url: uploadResult.url,
        fileName: fileName,
        fileSize: uploadResult.fileSize
      },
      originalScore: user.atsReport.score,
      optimizedScore: optimizedAnalysis.score,
      scoreImprovement: optimizedAnalysis.score - user.atsReport.score
    });
  } catch (error) {
    console.error('Error optimizing resume:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to optimize resume',
      details: error.message
    });
  }
};

/**
 * Download optimized resume
 * GET /api/resume/optimized/download
 */
const downloadOptimizedResume = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId);

    if (!user || !user.atsReport || !user.atsReport.optimizedResumeKey) {
      return res.status(404).json({
        success: false,
        error: 'Optimized resume not found. Please optimize your resume first.'
      });
    }

    // Generate signed URL for download (valid for 1 hour)
    const signedUrl = await getSignedUrl(user.atsReport.optimizedResumeKey, 3600);

    res.json({
      success: true,
      downloadUrl: signedUrl,
      fileName: user.atsReport.optimizedResumeDetails?.fileName || 'optimized_resume.pdf'
    });
  } catch (error) {
    console.error('Error getting optimized resume download URL:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get download URL',
      details: error.message
    });
  }
};

module.exports = {
  analyzeResume,
  getATSReport,
  optimizeResume,
  downloadOptimizedResume
};

