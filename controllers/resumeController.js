const User = require('../models/User');
const { extractResumeText, parseResumeStructure } = require('../utils/resumeExtractor');
const { analyzeATS } = require('../utils/atsAnalyzer');
const { getSignedUrl, getFileBufferFromS3 } = require('../utils/s3Service');
const { isAtsEligible, optimizeResumeFromUserDoc } = require('../utils/resumePipeline');

/**
 * Ensure user has ATS analysis for the *current* resume file (same logic as POST /analyze).
 * Used when optimizing so callers do not hit "analyze first" after upload or resume replace.
 */
async function ensureAtsReportForCurrentResume(userId) {
  let user = await User.findById(userId);
  if (!user?.resume_details?.key) return user;

  const keyMatches =
    user.atsReport?.originalResumeKey &&
    user.atsReport.originalResumeKey === user.resume_details.key;
  const hasScore = user.atsReport && user.atsReport.score != null;

  if (hasScore && keyMatches) {
    return user;
  }

  const fileBuffer = await getFileBufferFromS3(user.resume_details.key);
  const resumeText = await extractResumeText(fileBuffer, user.resume_details.mimeType);
  const resumeStructure = parseResumeStructure(resumeText);
  const analysisResult = await analyzeATS(resumeText, resumeStructure);

  const atsReport = {
    score: analysisResult.score,
    analyzedAt: new Date(),
    summary: analysisResult.summary || 'ATS analysis completed',
    recommendations: analysisResult.recommendations || [],
    strengths: analysisResult.strengths || [],
    weaknesses: analysisResult.weaknesses || [],
    originalResumeKey: user.resume_details.key
  };

  await User.findByIdAndUpdate(userId, { atsReport });
  return User.findById(userId);
}

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

    if (!isAtsEligible(user)) {
      return res.status(403).json({
        success: false,
        error:
          'ATS analysis is available on Standard, Pro, Premium, or with the Custom Resume Rewrite add-on.'
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
    const hasValidReport =
      user?.atsReport &&
      user.atsReport.score !== null &&
      user.atsReport.score !== undefined;

    if (!hasValidReport) {
      if (!isAtsEligible(user)) {
        return res.status(404).json({
          success: false,
          error: 'ATS resume tools are not included in your current plan.',
          upgradeRequired: true
        });
      }
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
const optimizeResume = async (req, res) => {
  try {
    const userId = req.userId;
    let user = await User.findById(userId);

    if (!user || !user.resume_details || !user.resume_details.key) {
      return res.status(404).json({
        success: false,
        error: 'Resume not found. Please upload a resume first.'
      });
    }

    if (!isAtsEligible(user)) {
      return res.status(403).json({
        success: false,
        error:
          'ATS resume optimization requires Standard, Pro, Premium, or the Custom Resume Rewrite add-on.'
      });
    }

    user = await ensureAtsReportForCurrentResume(userId);
    if (!user.atsReport || user.atsReport.score == null) {
      return res.status(500).json({
        success: false,
        error: 'Could not complete ATS analysis. Please try again in a moment.'
      });
    }

    const { uploadResult, optimizedAnalysis } = await optimizeResumeFromUserDoc(user);

    res.json({
      success: true,
      message: 'Resume optimized successfully',
      optimizedResume: {
        url: uploadResult.url,
        fileName: uploadResult.fileName,
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

