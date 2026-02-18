const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Analyze resume for ATS compatibility
 * @param {String} resumeText - Extracted resume text
 * @param {Object} resumeStructure - Parsed resume structure
 * @returns {Promise<Object>} - ATS analysis result
 */
const analyzeATS = async (resumeText, resumeStructure) => {
  try {
    const prompt = `You are an expert ATS (Applicant Tracking System) compatibility analyzer. Analyze the following resume and provide a comprehensive ATS compatibility report.

RESUME TEXT:
${resumeText}

RESUME STRUCTURE:
- Word Count: ${resumeStructure.wordCount}
- Line Count: ${resumeStructure.lineCount}
- Sections Found: ${Object.keys(resumeStructure.sections).filter(key => resumeStructure.sections[key].length > 0).join(', ')}

Please analyze this resume for ATS compatibility and provide:
1. Overall ATS Score (0-100) - a single number
2. Detailed analysis covering:
   - Contact Information Completeness (email, phone, address)
   - Formatting Issues (tables, images, complex layouts, fonts)
   - Keyword Optimization (relevant keywords, industry terms)
   - Structure and Organization (clear sections, proper headings)
   - File Format Compatibility (PDF formatting issues)
   - Content Quality (clarity, conciseness, relevance)

3. Specific Recommendations - an array of recommendations, each with:
   - category: one of ['formatting', 'keywords', 'structure', 'content', 'contact', 'other']
   - severity: one of ['high', 'medium', 'low']
   - issue: brief description of the issue
   - suggestion: actionable recommendation to fix the issue

Return your response as a JSON object with this exact structure:
{
  "score": <number 0-100>,
  "summary": "<brief summary of overall ATS compatibility>",
  "recommendations": [
    {
      "category": "<category>",
      "severity": "<severity>",
      "issue": "<issue description>",
      "suggestion": "<actionable suggestion>"
    }
  ],
  "strengths": ["<strength1>", "<strength2>", ...],
  "weaknesses": ["<weakness1>", "<weakness2>", ...]
}

Be thorough and specific. Focus on actionable improvements that will increase ATS compatibility.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are an expert ATS (Applicant Tracking System) compatibility analyzer. Always respond with valid JSON only.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    const content = response.choices[0].message.content.trim();
    
    // Try to extract JSON from the response
    let analysisResult;
    try {
      // Remove markdown code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      const jsonString = jsonMatch ? jsonMatch[1] : content;
      analysisResult = JSON.parse(jsonString);
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError);
      console.error('Response content:', content);
      // Fallback: create a basic analysis
      analysisResult = {
        score: 50,
        summary: 'Unable to fully analyze resume. Please ensure resume is properly formatted.',
        recommendations: [
          {
            category: 'other',
            severity: 'medium',
            issue: 'Could not parse analysis results',
            suggestion: 'Please try uploading the resume again or ensure it contains readable text.'
          }
        ],
        strengths: [],
        weaknesses: ['Analysis parsing failed']
      };
    }

    // Validate and ensure required fields
    if (!analysisResult.score || typeof analysisResult.score !== 'number') {
      analysisResult.score = 50;
    }
    if (!analysisResult.recommendations || !Array.isArray(analysisResult.recommendations)) {
      analysisResult.recommendations = [];
    }
    if (!analysisResult.summary) {
      analysisResult.summary = 'ATS analysis completed';
    }

    return analysisResult;
  } catch (error) {
    console.error('Error analyzing resume with OpenAI:', error);
    throw new Error(`Failed to analyze resume: ${error.message}`);
  }
};

module.exports = {
  analyzeATS
};

