const OpenAI = require('openai');
const { toFile } = require('openai/uploads');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const QUESTION_COUNT = 8;

const parseJsonResponse = (raw) => {
  const trimmed = (raw || '').trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Model did not return valid JSON');
  }
};

/**
 * Generate interview questions based on job role and/or description.
 */
const generateQuestions = async (jobRole, jobDescription) => {
  const context = [
    jobRole ? `Job Role: ${jobRole}` : '',
    jobDescription ? `Job Description:\n${jobDescription}` : ''
  ]
    .filter(Boolean)
    .join('\n\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert technical interviewer. Generate realistic interview questions tailored to the role. Respond with valid JSON only.'
      },
      {
        role: 'user',
        content: `Generate exactly ${QUESTION_COUNT} interview questions for this role.

${context}

Return JSON:
{
  "questions": ["question 1", "question 2", ...]
}

Mix behavioral, technical, and situational questions appropriate for the role.`
      }
    ],
    temperature: 0.7,
    max_tokens: 2000,
    response_format: { type: 'json_object' }
  });

  const parsed = parseJsonResponse(response.choices[0].message.content);
  const questions = (parsed.questions || []).slice(0, QUESTION_COUNT);

  if (questions.length < 5) {
    throw new Error('Failed to generate enough interview questions');
  }

  return questions.map((question, index) => ({
    question,
    order: index + 1,
    transcript: '',
    evaluation: null,
    answeredAt: null
  }));
};

/**
 * Transcribe audio buffer using Whisper.
 */
const transcribeAudio = async (buffer, mimeType, originalName) => {
  const ext = originalName?.split('.').pop() || (mimeType.includes('webm') ? 'webm' : 'mp4');
  const file = await toFile(buffer, `answer.${ext}`, { type: mimeType || 'audio/webm' });

  const transcription = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1'
  });

  return (transcription.text || '').trim();
};

/**
 * Evaluate a single answer against the question and job context.
 */
const evaluateAnswer = async (question, transcript, jobRole, jobDescription) => {
  const context = [
    jobRole ? `Role: ${jobRole}` : '',
    jobDescription ? `Job Description: ${jobDescription.slice(0, 1500)}` : ''
  ]
    .filter(Boolean)
    .join('\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert interview coach. Evaluate candidate answers fairly and constructively. Respond with valid JSON only.'
      },
      {
        role: 'user',
        content: `Evaluate this interview answer.

${context}

Question: ${question}
Candidate Answer (transcribed from audio): ${transcript || '(no speech detected)'}

Return JSON:
{
  "score": 0-10 number,
  "feedback": "2-3 sentence overall feedback",
  "strengths": ["strength 1", "strength 2"],
  "improvements": ["improvement 1", "improvement 2"]
}`
      }
    ],
    temperature: 0.4,
    max_tokens: 800,
    response_format: { type: 'json_object' }
  });

  const parsed = parseJsonResponse(response.choices[0].message.content);
  return {
    score: Math.min(10, Math.max(0, Number(parsed.score) || 0)),
    feedback: parsed.feedback || '',
    strengths: parsed.strengths || [],
    improvements: parsed.improvements || []
  };
};

/**
 * Generate final interview report from all Q&A evaluations.
 */
const generateFinalReport = async (interview) => {
  const qaSummary = interview.questions
    .map(
      (q, i) =>
        `Q${i + 1}: ${q.question}\nAnswer: ${q.transcript || '(no answer)'}\nScore: ${q.evaluation?.score ?? 'N/A'}/10\nFeedback: ${q.evaluation?.feedback || ''}`
    )
    .join('\n\n');

  const avgScore =
    interview.questions.reduce((sum, q) => sum + (q.evaluation?.score || 0), 0) /
    interview.questions.length;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert interview coach writing a final performance report. Be encouraging but honest. Respond with valid JSON only.'
      },
      {
        role: 'user',
        content: `Create a final interview report.

Role: ${interview.jobRole || 'Not specified'}
Job Description: ${(interview.jobDescription || '').slice(0, 1000)}
Average Score: ${avgScore.toFixed(1)}/10

All Q&A:
${qaSummary}

Return JSON:
{
  "overallScore": ${Math.round(avgScore * 10) / 10},
  "summary": "3-4 sentence overall performance summary",
  "strengths": ["top strength 1", "top strength 2", "top strength 3"],
  "improvements": ["area to improve 1", "area to improve 2", "area to improve 3"],
  "tips": ["actionable tip 1", "actionable tip 2", "actionable tip 3"]
}`
      }
    ],
    temperature: 0.5,
    max_tokens: 1200,
    response_format: { type: 'json_object' }
  });

  const parsed = parseJsonResponse(response.choices[0].message.content);
  return {
    overallScore: Math.min(10, Math.max(0, Number(parsed.overallScore) || avgScore)),
    summary: parsed.summary || '',
    strengths: parsed.strengths || [],
    improvements: parsed.improvements || [],
    tips: parsed.tips || []
  };
};

module.exports = {
  generateQuestions,
  transcribeAudio,
  evaluateAnswer,
  generateFinalReport,
  QUESTION_COUNT
};
