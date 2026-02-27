const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Optimize resume content for ATS compatibility
 * @param {String} resumeText - Original resume text
 * @param {Object} atsAnalysis - Previous ATS analysis with recommendations
 * @returns {Promise<String>} - Optimized resume text
 */
const optimizeResumeContent = async (resumeText, atsAnalysis) => {
  try {
    const recommendations = atsAnalysis.recommendations || [];
    const highPriorityIssues = recommendations
      .filter(rec => rec.severity === 'high')
      .map(rec => `- ${rec.issue}: ${rec.suggestion}`)
      .join('\n');

    const prompt = `You are an expert resume optimizer specializing in ATS (Applicant Tracking System) compatibility. 

ORIGINAL RESUME:
${resumeText}

ATS ANALYSIS ISSUES TO ADDRESS:
${highPriorityIssues || 'General ATS optimization needed'}

Please optimize this resume to be ATS-friendly while maintaining all original information and facts. Key requirements:

1. PRESERVE ALL INFORMATION: Do not remove or change any factual information (names, dates, companies, job titles, skills, education, etc.)

2. IMPROVE ATS COMPATIBILITY:
   - Use standard, simple formatting
   - Ensure clear section headers (Contact, Experience, Education, Skills)
   - Use standard fonts (Arial, Times New Roman, Calibri)
   - Remove any complex formatting, tables, or graphics
   - Optimize keyword usage naturally
   - Ensure proper spacing and readability

3. MAINTAIN PROFESSIONAL TONE: Keep the professional tone and style appropriate for the industry

4. STRUCTURE REQUIREMENTS:
   - Start with Contact Information section (Name, Email, Phone, Location, LinkedIn/GitHub if provided)
   - Follow with Professional Summary/Objective (if present)
   - Then Experience section with clear job entries
   - Then Education section
   - Then Skills section
   - Any additional sections (Certifications, Projects, etc.)

5. FORMATTING GUIDELINES:
   - Use clear section headers in ALL CAPS or Title Case
   - Use consistent date formats (MM/YYYY or Month YYYY)
   - Use bullet points for job descriptions
   - Keep line spacing consistent
   - Avoid special characters that might break parsing

Return the optimized resume text ready to be converted to a clean PDF. The text should be well-structured and ATS-friendly.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert resume optimizer. Always return clean, well-formatted resume text optimized for ATS systems.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 3000
    });

    const optimizedText = response.choices[0].message.content.trim();
    
    // Remove any markdown formatting if present
    const cleanedText = optimizedText
      .replace(/```[\w]*\n/g, '')
      .replace(/```/g, '')
      .trim();

    return cleanedText;
  } catch (error) {
    console.error('Error optimizing resume with OpenAI:', error);
    throw new Error(`Failed to optimize resume: ${error.message}`);
  }
};

module.exports = {
  optimizeResumeContent
};

