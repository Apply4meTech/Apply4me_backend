const Interview = require('../models/Interview');
const {
  generateQuestions,
  transcribeAudio,
  evaluateAnswer,
  generateFinalReport
} = require('../services/interviewService');
const { getInterviewQuotaForUser } = require('../utils/interviewQuota');
const { formatInterview, formatInterviewSummary } = require('../utils/interviewResponse');

/**
 * GET /api/interviews/quota
 */
const getInterviewQuota = async (req, res) => {
  try {
    const quota = await getInterviewQuotaForUser(req.userId);
    if (!quota) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: quota });
  } catch (error) {
    console.error('Get interview quota error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch interview quota' });
  }
};

/**
 * POST /api/interviews/start
 */
const startInterview = async (req, res) => {
  try {
    const userId = req.userId;
    const { jobRole = '', jobDescription = '' } = req.body;

    const quota = await getInterviewQuotaForUser(userId);
    if (!quota?.eligible) {
      return res.status(403).json({
        success: false,
        error:
          'Interview prep is available on Pro (1 session) and Premium (3 sessions) plans, or with the Interview Prep add-on.'
      });
    }
    if (!quota.canStart) {
      return res.status(403).json({
        success: false,
        error: `You have used all ${quota.limit} interview prep session${quota.limit === 1 ? '' : 's'}. Upgrade your plan or purchase an add-on for more.`
      });
    }

    if (!jobRole.trim() && !jobDescription.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a job role or job description.'
      });
    }

    const questions = await generateQuestions(jobRole.trim(), jobDescription.trim());

    const interview = await Interview.create({
      userId,
      jobRole: jobRole.trim(),
      jobDescription: jobDescription.trim(),
      questions,
      currentQuestionIndex: 0,
      status: 'in_progress'
    });

    res.status(201).json({
      success: true,
      message: 'Interview started',
      data: formatInterview(interview)
    });
  } catch (error) {
    console.error('Start interview error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to start interview'
    });
  }
};

/**
 * GET /api/interviews
 */
const listInterviews = async (req, res) => {
  try {
    const userId = req.userId;
    const interviews = await Interview.find({ userId })
      .sort({ createdAt: -1 })
      .select('jobRole jobDescription status report completedAt createdAt questions');

    const data = interviews.map((item) => formatInterviewSummary(item));

    res.json({ success: true, data });
  } catch (error) {
    console.error('List interviews error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interviews'
    });
  }
};

/**
 * GET /api/interviews/:id
 */
const getInterview = async (req, res) => {
  try {
    const userId = req.userId;
    const interview = await Interview.findOne({ _id: req.params.id, userId });

    if (!interview) {
      return res.status(404).json({
        success: false,
        error: 'Interview not found'
      });
    }

    res.json({ success: true, data: formatInterview(interview) });
  } catch (error) {
    console.error('Get interview error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch interview'
    });
  }
};

/**
 * POST /api/interviews/:id/answer
 */
const submitAnswer = async (req, res) => {
  try {
    const userId = req.userId;
    const interview = await Interview.findOne({ _id: req.params.id, userId });

    if (!interview) {
      return res.status(404).json({
        success: false,
        error: 'Interview not found'
      });
    }

    if (interview.status === 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Interview is already completed'
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Audio file is required'
      });
    }

    const idx = interview.currentQuestionIndex;
    if (idx >= interview.questions.length) {
      return res.status(400).json({
        success: false,
        error: 'All questions have been answered'
      });
    }

    const currentQuestion = interview.questions[idx];
    const transcript = await transcribeAudio(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    const evaluation = await evaluateAnswer(
      currentQuestion.question,
      transcript,
      interview.jobRole,
      interview.jobDescription
    );

    interview.questions[idx].transcript = transcript;
    interview.questions[idx].evaluation = evaluation;
    interview.questions[idx].answeredAt = new Date();
    interview.currentQuestionIndex = idx + 1;

    const isLastQuestion = idx + 1 >= interview.questions.length;

    if (isLastQuestion) {
      interview.report = await generateFinalReport(interview);
      interview.status = 'completed';
      interview.completedAt = new Date();
    }

    await interview.save();

    res.json({
      success: true,
      message: isLastQuestion ? 'Interview completed' : 'Answer submitted',
      data: formatInterview(interview),
      isComplete: isLastQuestion
    });
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to process answer'
    });
  }
};

module.exports = {
  getInterviewQuota,
  startInterview,
  listInterviews,
  getInterview,
  submitAnswer
};
