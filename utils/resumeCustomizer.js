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
  "summary": "string or empty",
  "experience": [
    {
      "title": "job title",
      "company": "company name",
      "location": "city/state or empty",
      "dates": "e.g. Jan 2020 – Present",
      "bullets": ["...", "..."]
    }
  ],
  "education": [
    {
      "degree": "",
      "school": "",
      "location": "",
      "dates": "",
      "details": ""
    }
  ],
  "skills": ["..."] OR [ { "label": "Category", "items": ["a","b"] } ],
  "certifications": [ { "name": "", "issuer": "", "date": "" } ],
  "projects": [ { "name": "", "description": "", "bullets": [] } ]
}

Rules:
- Preserve all factual information; do not invent employers, dates, or credentials.
- Tailor bullet wording and ordering to the job description; emphasize relevant keywords naturally.
- Omit empty sections or use empty strings for missing fields.`;

/**
 * Customize resume for a job; returns structured data + plain text.
 * @param {String} resumeText - Original resume text
 * @param {String} jobDescription - Job description
 * @returns {Promise<{ structured: import('./resumeStructured').StructuredResume, plainText: string }>}
 */
const customizeResumeForJob = async (resumeText, jobDescription) => {
  try {
    const prompt = `You are an expert resume writer. Tailor this resume to the job description using the JSON schema below.

ORIGINAL RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription || 'No job description provided.'}

Requirements:
1. Keep all factual data (contact, employers, dates, schools) accurate.
2. Reword and reorder bullets to align with the role; add keywords from the job description where truthful.
3. Keep similar overall length.

${RESUME_JSON_INSTRUCTION}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content:
            'You are an expert resume writer. Respond with valid JSON only, no markdown, no prose outside the JSON object.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4,
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
    console.error('Error customizing resume with OpenAI:', error);
    throw new Error(`Failed to customize resume: ${error.message}`);
  }
};

module.exports = {
  customizeResumeForJob
};
