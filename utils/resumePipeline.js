const User = require('../models/User');
const { extractResumeText, parseResumeStructure } = require('./resumeExtractor');
const { analyzeATS } = require('./atsAnalyzer');
const { optimizeResumeContent } = require('./resumeOptimizer');
const { generateATSFriendlyPDF } = require('./pdfGenerator');
const { uploadFileToS3, getFileBufferFromS3 } = require('./s3Service');

const ATS_PLANS = ['Standard', 'Pro', 'Premium'];

/**
 * User may receive ATS analysis + PDF: Standard+ or Custom Resume Rewrite add-on.
 */
function isAtsEligible(user) {
  if (!user) return false;
  const plan = user.subscription?.planName;
  const hasAddon = user.purchasedAddons?.some((a) => a.name === 'resume_rewrite');
  return ATS_PLANS.includes(plan) || !!hasAddon;
}

/**
 * After resume upload: Starter (no addon) clears ATS; eligible users get analysis + optimized PDF (background).
 */
async function runPostUploadResumePipeline(userId) {
  const user = await User.findById(userId);
  if (!user || !user.resume_details?.key) return;

  if (!isAtsEligible(user)) {
    await User.findByIdAndUpdate(userId, { $unset: { atsReport: 1 } });
    console.log(`[resumePipeline] Cleared ATS data for user ${userId} (plan has no ATS)`);
    return;
  }

  try {
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
    console.log(`[resumePipeline] ATS analysis done for user ${userId} — score ${analysisResult.score}`);

    const fresh = await User.findById(userId);
    await optimizeResumeFromUserDoc(fresh);
    console.log(`[resumePipeline] ATS-friendly PDF generated for user ${userId}`);
  } catch (err) {
    console.error(`[resumePipeline] Post-upload ATS pipeline failed for user ${userId}:`, err.message);
  }
}

/**
 * Generate ATS-friendly PDF from current resume + existing atsReport (mongoose user doc).
 */
async function optimizeResumeFromUserDoc(user) {
  if (!user?.resume_details?.key) {
    throw new Error('Resume not found');
  }
  if (!user.atsReport || user.atsReport.score == null) {
    throw new Error('ATS analysis required before optimization');
  }

  const fileBuffer = await getFileBufferFromS3(user.resume_details.key);
  const resumeText = await extractResumeText(fileBuffer, user.resume_details.mimeType);
  const { structured, plainText } = await optimizeResumeContent(resumeText, user.atsReport);

  const pdfBuffer = await generateATSFriendlyPDF(structured);
  const fileName = `optimized_${user.resume_details.fileName.replace(/\.[^/.]+$/, '')}.pdf`;
  const uploadResult = await uploadFileToS3(pdfBuffer, fileName, 'application/pdf', 'resumes/optimized');

  const optimizedStructure = parseResumeStructure(plainText);
  const optimizedAnalysis = await analyzeATS(plainText, optimizedStructure);

  const base = user.atsReport.toObject ? user.atsReport.toObject() : { ...user.atsReport };
  const updatedAtsReport = {
    ...base,
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

  await User.findByIdAndUpdate(user._id, { atsReport: updatedAtsReport });
  return { updatedAtsReport, uploadResult, optimizedAnalysis };
}

module.exports = {
  ATS_PLANS,
  isAtsEligible,
  runPostUploadResumePipeline,
  optimizeResumeFromUserDoc
};
