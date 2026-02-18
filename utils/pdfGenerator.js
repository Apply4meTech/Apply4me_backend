const PDFDocument = require('pdfkit');

/**
 * Generate ATS-friendly PDF from text
 * @param {String} resumeText - Optimized resume text
 * @returns {Promise<Buffer>} - PDF buffer
 */
const generateATSFriendlyPDF = async (resumeText) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: {
          top: 72,      // 1 inch
          bottom: 72,   // 1 inch
          left: 72,     // 1 inch
          right: 72     // 1 inch
        },
        info: {
          Title: 'Resume',
          Author: 'ApplyForMe',
          Subject: 'ATS-Optimized Resume'
        }
      });

      const chunks = [];
      
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Configure font - use standard ATS-friendly font
      const fontSize = 11;
      const lineHeight = 14;
      const sectionSpacing = 8;
      const paragraphSpacing = 4;

      // Parse text into sections
      const lines = resumeText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
      
      let currentY = doc.page.margins.top;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const maxY = doc.page.height - doc.page.margins.bottom;

      // Helper function to check if we need a new page
      const checkNewPage = (requiredHeight) => {
        if (currentY + requiredHeight > maxY) {
          doc.addPage();
          currentY = doc.page.margins.top;
        }
      };

      // Helper function to add text with word wrapping
      const addTextWithWrap = (text, options = {}) => {
        const {
          fontSize: fs = fontSize,
          font: f = 'Helvetica',
          bold = false,
          color = 'black',
          spacing = paragraphSpacing
        } = options;

        doc.font(f).fontSize(fs);
        if (bold) doc.font('Helvetica-Bold');
        doc.fillColor(color);

        checkNewPage(fs + spacing);

        const textLines = doc.heightOfString(text, {
          width: pageWidth,
          align: 'left'
        });

        doc.text(text, {
          x: doc.page.margins.left,
          y: currentY,
          width: pageWidth,
          align: 'left',
          lineGap: 2
        });

        currentY += textLines + spacing;
      };

      // Process lines and identify sections
      let i = 0;
      let previousWasHeader = false;
      
      while (i < lines.length) {
        const line = lines[i];
        if (!line || line.trim().length === 0) {
          i++;
          continue;
        }
        
        const upperLine = line.toUpperCase().trim();

        // Check if this is a section header (all caps, short, or contains keywords)
        const isSectionHeader = (
          (upperLine === line && line.length < 50 && line.length > 2 && !line.includes('•')) ||
          upperLine.includes('CONTACT') ||
          upperLine.includes('EXPERIENCE') ||
          upperLine.includes('EDUCATION') ||
          upperLine.includes('SKILLS') ||
          upperLine.includes('SUMMARY') ||
          upperLine.includes('OBJECTIVE') ||
          upperLine.includes('PROFESSIONAL') ||
          upperLine.includes('CERTIFICATION') ||
          upperLine.includes('PROJECT') ||
          upperLine.includes('WORK HISTORY') ||
          upperLine.includes('EMPLOYMENT')
        );

        if (isSectionHeader) {
          // Add spacing before section header (if not first item)
          if (i > 0 && !previousWasHeader) {
            currentY += sectionSpacing;
            checkNewPage(fontSize + sectionSpacing);
          }
          
          // Add section header
          addTextWithWrap(line, {
            fontSize: 14,
            bold: true,
            color: '#000000',
            spacing: sectionSpacing
          });
          previousWasHeader = true;
        } else {
          // Regular content
          // Check if line looks like a job title or company (starts with common patterns)
          const isJobTitle = /^[A-Z][a-z]+/.test(line.trim()) && line.length < 80 && !line.includes('•');
          
          if (isJobTitle && i > 0 && !previousWasHeader && !lines[i - 1]?.toUpperCase().includes('EXPERIENCE')) {
            addTextWithWrap(line, {
              fontSize: 12,
              bold: true,
              spacing: 2
            });
          } else {
            // Handle bullet points
            const cleanLine = line.replace(/^[•·▪▫\-\*]\s*/, '').trim();
            addTextWithWrap(cleanLine || line, {
              fontSize: fontSize,
              spacing: paragraphSpacing
            });
          }
          previousWasHeader = false;
        }

        i++;
      }

      doc.end();
    } catch (error) {
      reject(new Error(`Failed to generate PDF: ${error.message}`));
    }
  });
};

/**
 * Format resume text for better PDF generation
 * @param {String} text - Raw resume text
 * @returns {String} - Formatted text
 */
const formatResumeText = (text) => {
  // Clean up the text
  let formatted = text
    // Remove excessive whitespace
    .replace(/\n{3,}/g, '\n\n')
    // Ensure section headers are clear
    .replace(/\n([A-Z][A-Z\s]{2,30})\n/g, '\n\n$1\n\n')
    // Clean up bullet points
    .replace(/[•·▪▫]/g, '•')
    // Ensure consistent spacing
    .trim();

  return formatted;
};

module.exports = {
  generateATSFriendlyPDF,
  formatResumeText
};

