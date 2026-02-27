const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Customize resume content for a specific job description
 * Used for non-Starter plans: each resume is tailored to the job.
 * @param {String} resumeText - Original resume text
 * @param {String} jobDescription - Job description (from metadata or pasted by employee)
 * @returns {Promise<String>} - Customized resume text
 */
const customizeResumeForJob = async (resumeText, jobDescription) => {
  try {
    const prompt = `You are an expert resume writer. Customize this resume to match the following job description.

ORIGINAL RESUME:
${resumeText}

JOB DESCRIPTION:
${jobDescription || 'No job description provided.'}

Requirements:
1. PRESERVE ALL FACTUAL INFORMATION: Do not invent or change names, dates, companies, job titles, education, or contact details.
2. TAILOR CONTENT: Emphasize and rephrase relevant experience, skills, and achievements to align with the job description. Use keywords from the job description where they fit naturally.
3. KEEP SECTIONS: Maintain clear sections (Contact, Experience, Education, Skills, etc.). You may reorder bullet points within a role to put most relevant first.
4. LENGTH: Keep similar length; do not add fluff. One-page or two-page resume style.
5. FORMAT: Use standard section headers (e.g. EXPERIENCE, EDUCATION, SKILLS). Use bullet points. No markdown or code blocks.
6. TONE: Professional and consistent with the original resume.

Return only the customized resume text, ready to be converted to PDF. No explanations or preamble.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume writer. Return only the resume text, no markdown or code blocks.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 3500
    });

    const customizedText = response.choices[0].message.content.trim();
    const cleanedText = customizedText
      .replace(/```[\w]*\n/g, '')
      .replace(/```/g, '')
      .trim();

    return cleanedText;
  } catch (error) {
    console.error('Error customizing resume with OpenAI:', error);
    throw new Error(`Failed to customize resume: ${error.message}`);
  }
};

module.exports = {
  customizeResumeForJob
};
