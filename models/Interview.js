const mongoose = require('mongoose');

const answerEvaluationSchema = new mongoose.Schema(
  {
    score: { type: Number, min: 0, max: 10 },
    feedback: { type: String, default: '' },
    strengths: [{ type: String }],
    improvements: [{ type: String }]
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    order: { type: Number, required: true },
    transcript: { type: String, default: '' },
    evaluation: { type: answerEvaluationSchema, default: null },
    answeredAt: { type: Date, default: null }
  },
  { _id: true }
);

const reportSchema = new mongoose.Schema(
  {
    overallScore: { type: Number, min: 0, max: 10 },
    summary: { type: String, default: '' },
    strengths: [{ type: String }],
    improvements: [{ type: String }],
    tips: [{ type: String }]
  },
  { _id: false }
);

const interviewSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    jobRole: { type: String, default: '' },
    jobDescription: { type: String, default: '' },
    status: {
      type: String,
      enum: ['in_progress', 'completed', 'abandoned'],
      default: 'in_progress'
    },
    currentQuestionIndex: { type: Number, default: 0 },
    questions: [questionSchema],
    report: { type: reportSchema, default: null },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Interview', interviewSchema);
