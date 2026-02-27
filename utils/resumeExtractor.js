const pdfParse = require('pdf-parse-new');
const mammoth = require('mammoth');

/**
 * Extract text from PDF file
 * @param {Buffer} fileBuffer - PDF file buffer
 * @returns {Promise<String>} - Extracted text
 */
const extractTextFromPDF = async (fileBuffer) => {
  try {
    const data = await pdfParse(fileBuffer);
    return data.text;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message}`);
  }
};

/**
 * Extract text from DOCX file
 * @param {Buffer} fileBuffer - DOCX file buffer
 * @returns {Promise<String>} - Extracted text
 */
const extractTextFromDOCX = async (fileBuffer) => {
  try {
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  } catch (error) {
    console.error('Error extracting text from DOCX:', error);
    throw new Error(`Failed to extract text from DOCX: ${error.message}`);
  }
};

/**
 * Extract text from resume file (PDF or DOCX)
 * @param {Buffer} fileBuffer - File buffer
 * @param {String} mimeType - File MIME type
 * @returns {Promise<String>} - Extracted text
 */
const extractResumeText = async (fileBuffer, mimeType) => {
  try {
    if (mimeType === 'application/pdf') {
      return await extractTextFromPDF(fileBuffer);
    } else if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      mimeType === 'application/msword'
    ) {
      return await extractTextFromDOCX(fileBuffer);
    } else {
      throw new Error(`Unsupported file type: ${mimeType}`);
    }
  } catch (error) {
    console.error('Error extracting resume text:', error);
    throw error;
  }
};

/**
 * Parse resume text into structured sections
 * @param {String} text - Raw resume text
 * @returns {Object} - Structured resume data
 */
const parseResumeStructure = (text) => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  const sections = {
    contact: [],
    summary: [],
    experience: [],
    education: [],
    skills: [],
    other: []
  };

  let currentSection = 'other';
  const sectionKeywords = {
    contact: ['contact', 'email', 'phone', 'address', 'linkedin', 'github', 'website'],
    summary: ['summary', 'objective', 'profile', 'about'],
    experience: ['experience', 'employment', 'work history', 'career', 'professional'],
    education: ['education', 'academic', 'qualifications', 'degree'],
    skills: ['skills', 'technical skills', 'competencies', 'expertise']
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].toLowerCase();
    
    // Check if this line indicates a section header
    for (const [section, keywords] of Object.entries(sectionKeywords)) {
      if (keywords.some(keyword => line.includes(keyword) && line.length < 50)) {
        currentSection = section;
        break;
      }
    }
    
    sections[currentSection].push(lines[i]);
  }

  return {
    rawText: text,
    sections: sections,
    wordCount: text.split(/\s+/).length,
    lineCount: lines.length
  };
};

module.exports = {
  extractResumeText,
  parseResumeStructure,
  extractTextFromPDF,
  extractTextFromDOCX
};

