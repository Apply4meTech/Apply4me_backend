const formatInterview = (doc) => {
  const interview = doc.toObject ? doc.toObject() : doc;
  return {
    id: interview._id,
    jobRole: interview.jobRole,
    jobDescription: interview.jobDescription,
    status: interview.status,
    currentQuestionIndex: interview.currentQuestionIndex,
    totalQuestions: interview.questions?.length || 0,
    questions: interview.questions,
    report: interview.report,
    completedAt: interview.completedAt,
    createdAt: interview.createdAt,
    updatedAt: interview.updatedAt
  };
};

const formatInterviewSummary = (doc) => {
  const interview = doc.toObject ? doc.toObject() : doc;
  return {
    id: interview._id,
    jobRole: interview.jobRole,
    jobDescription: interview.jobDescription,
    status: interview.status,
    overallScore: interview.report?.overallScore ?? null,
    totalQuestions: interview.questions?.length || 0,
    answeredCount: interview.questions?.filter((q) => q.transcript).length || 0,
    completedAt: interview.completedAt,
    createdAt: interview.createdAt
  };
};

module.exports = {
  formatInterview,
  formatInterviewSummary
};
