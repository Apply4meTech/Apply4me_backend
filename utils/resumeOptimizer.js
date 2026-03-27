const OpenAI = require('openai');
const {
  normalizeStructuredResume,
  structuredResumeToPlainText,
  parseResumeJson
} = require('./resumeStructured');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const RESUME_JSON_INSTRUCTION = `Return a single JSON object (no markdown, no code fences) with this exact shape:
{
  "contact": {
    "fullName": "string",
    "email": "string or empty",
    "phone": "string or empty",
    "location": "string or empty",
    "linkedin": "string or empty",
    "github": "string or empty",
    "website": "string or empty"
  },
  "summary": "string or empty — professional summary if present",
  "experience": [
    {
      "title": "job title",
      "company": "company name",
      "location": "city/state or empty",
      "dates": "e.g. Jan 2020 – Present",
      "bullets": ["achievement or responsibility", "..."]
    }
  ],
  "education": [
    {
      "degree": "e.g. B.S. Computer Science",
      "school": "university name",
      "location": "or empty",
      "dates": "or empty",
      "details": "honors/GPA line or empty"
    }
  ],
  "skills": ["skill1", "skill2"] OR [ { "label": "Category", "items": ["a","b"] } ],
  "certifications": [ { "name": "", "issuer": "", "date": "" } ],
  "projects": [ { "name": "", "description": "", "bullets": [] } ]
}

Rules:
- Preserve all factual data from the resume; do not invent employers, degrees, or dates.
- Omit empty arrays or use empty strings for missing optional fields.
- Every experience entry should have at least title or company and at least one bullet when the source had bullets.
- Use concise, ATS-friendly wording in bullets.`;

/**
 * Optimize resume for ATS; returns structured data + plain text for analysis.
 * @param {String} resumeText - Original resume text
 * @param {Object} atsAnalysis - Previous ATS analysis with recommendations
 * @returns {Promise<{ structured: import('./resumeStructured').StructuredResume, plainText: string }>}
 */
const optimizeResumeContent = async (resumeText, atsAnalysis) => {
  try {
    const recommendations = atsAnalysis.recommendations || [];
    const highPriorityIssues = recommendations
      .filter((rec) => rec.severity === 'high')
      .map((rec) => `- ${rec.issue}: ${rec.suggestion}`)
      .join('\n');

    const prompt = `You are an expert resume optimizer for ATS (Applicant Tracking System) compatibility.

ORIGINAL RESUME:
${resumeText}

HIGH-PRIORITY ATS ISSUES TO ADDRESS:
${highPriorityIssues || 'General ATS optimization'}

Optimize for ATS while keeping every fact accurate (names, dates, employers, schools, titles). Improve keywords and clarity where appropriate.

${RESUME_JSON_INSTRUCTION}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert resume optimizer. Respond with valid JSON only, no markdown, no prose outside the JSON object.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 4096,
      response_format: { type: 'json_object' }
    });

    const raw = response.choices[0].message.content?.trim() || '';
    let parsed = parseResumeJson(raw);
    if (!parsed) {
      try {
        parsed = JSON.parse(raw);
      } catch {
        throw new Error('Model did not return valid resume JSON');
      }
    }
    const structured = normalizeStructuredResume(parsed);
    const plainText = structuredResumeToPlainText(structured);
    return { structured, plainText };
  } catch (error) {
    console.error('Error optimizing resume with OpenAI:', error);
    throw new Error(`Failed to optimize resume: ${error.message}`);
  }
};

module.exports = {
  optimizeResumeContent
};
