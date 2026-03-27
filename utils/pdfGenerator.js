const PDFDocument = require('pdfkit');
const { buildStructuredResumeHtml } = require('./resumeHtmlTemplate');

/**
 * Render structured resume as PDF via HTML/CSS + headless Chrome (professional layout).
 * Falls back to PDFKit if Puppeteer fails or RESUME_PDF_ENGINE=pdfkit.
 * @param {import('./resumeStructured').StructuredResume} structured
 * @returns {Promise<Buffer>}
 */
const generateStructuredResumePDFHtml = async (structured) => {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    throw new Error('puppeteer not installed');
  }

  const html = buildStructuredResumeHtml(structured);
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, {
      waitUntil: 'load',
      timeout: 45000
    });
    await page.emulateMediaType('print');

    const pdfUint8 = await page.pdf({
      format: 'Letter',
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });

    return Buffer.from(pdfUint8);
  } finally {
    await browser.close();
  }
};

/**
 * Legacy: plain-text line-by-line PDF (fallback).
 * @param {String} resumeText
 * @returns {Promise<Buffer>}
 */
const generateATSFriendlyPDFFromPlainText = async (resumeText) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: 'Resume',
          Author: 'ApplyForMe',
          Subject: 'ATS-Optimized Resume'
        }
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const fontSize = 10;
      const lineHeight = 13;
      const sectionSpacing = 8;
      const paragraphSpacing = 3;

      const lines = resumeText.split('\n').map((line) => line.trim()).filter((line) => line.length > 0);

      let currentY = doc.page.margins.top;
      const left = doc.page.margins.left;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const maxY = doc.page.height - doc.page.margins.bottom;

      const checkNewPage = (requiredHeight) => {
        if (currentY + requiredHeight > maxY) {
          doc.addPage();
          currentY = doc.page.margins.top;
        }
      };

      const addTextWithWrap = (text, options = {}) => {
        const {
          fontSize: fs = fontSize,
          bold = false,
          spacing = paragraphSpacing
        } = options;

        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs);
        doc.fillColor('#111111');

        const h = doc.heightOfString(text, {
          width: pageWidth,
          align: 'left'
        });

        checkNewPage(h + spacing);
        doc.text(text, left, currentY, {
          width: pageWidth,
          align: 'left',
          lineGap: 2
        });

        currentY += h + spacing;
      };

      let i = 0;
      let previousWasHeader = false;

      while (i < lines.length) {
        const line = lines[i];
        if (!line || line.trim().length === 0) {
          i++;
          continue;
        }

        const upperLine = line.toUpperCase().trim();
        const isSectionHeader =
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
          upperLine.includes('EMPLOYMENT');

        if (isSectionHeader) {
          if (i > 0 && !previousWasHeader) {
            currentY += sectionSpacing;
            checkNewPage(fontSize + sectionSpacing);
          }
          addTextWithWrap(line, { fontSize: 12, bold: true, spacing: sectionSpacing });
          previousWasHeader = true;
        } else {
          const isJobTitle =
            /^[A-Z][a-z]+/.test(line.trim()) && line.length < 80 && !line.includes('•');
          if (isJobTitle && i > 0 && !previousWasHeader && !lines[i - 1]?.toUpperCase().includes('EXPERIENCE')) {
            addTextWithWrap(line, { fontSize: 11, bold: true, spacing: 2 });
          } else {
            const cleanLine = line.replace(/^[•·▪▫\-\*]\s*/, '').trim();
            addTextWithWrap(cleanLine || line, { fontSize, spacing: paragraphSpacing });
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
 * Structured PDF via PDFKit (plain layout; used when HTML engine disabled or fails).
 * @param {import('./resumeStructured').StructuredResume} structured
 * @returns {Promise<Buffer>}
 */
const generateStructuredResumePDFKit = async (structured) => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 48, bottom: 48, left: 52, right: 52 },
        info: {
          Title: 'Resume',
          Author: 'ApplyForMe',
          Subject: 'ATS-Optimized Resume'
        }
      });

      const chunks = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const left = doc.page.margins.left;
      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const bottom = doc.page.height - doc.page.margins.bottom;

      let y = doc.page.margins.top;

      const checkNewPage = (needed) => {
        if (y + needed > bottom) {
          doc.addPage();
          y = doc.page.margins.top;
        }
      };

      const textHeight = (text, fs, width, options = {}) => {
        doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs);
        return doc.heightOfString(text, { width, align: options.align || 'left', lineGap: options.lineGap ?? 2 });
      };

      const writeBlock = (text, opts = {}) => {
        const {
          fontSize: fs = 10,
          bold = false,
          color = '#111111',
          align = 'left',
          lineGap = 2,
          after = 6,
          x = left,
          width = pageWidth
        } = opts;
        if (!text || !String(text).trim()) return;
        const t = String(text).trim();
        const h = textHeight(t, fs, width, { bold, align, lineGap });
        checkNewPage(h + after);
        doc.fillColor(color);
        doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fs);
        doc.text(t, x, y, { width, align, lineGap });
        y += h + after;
      };

      const sectionRule = (title) => {
        checkNewPage(28);
        y += 4;
        doc.font('Helvetica-Bold').fontSize(10).fillColor('#000000');
        doc.text(String(title).toUpperCase(), left, y, { width: pageWidth, characterSpacing: 0.3 });
        const h = textHeight(String(title).toUpperCase(), 10, pageWidth, { bold: true });
        y += h + 2;
        doc.moveTo(left, y).lineTo(left + pageWidth, y).strokeColor('#bbbbbb').lineWidth(0.75).stroke();
        y += 10;
      };

      const c = structured.contact || {};

      // Header
      if (c.fullName) {
        const name = c.fullName.trim();
        const nh = textHeight(name, 20, pageWidth, { bold: true, align: 'center' });
        checkNewPage(nh + 8);
        doc.font('Helvetica-Bold').fontSize(20).fillColor('#111111');
        doc.text(name, left, y, { width: pageWidth, align: 'center', lineGap: 0 });
        y += nh + 6;
      }

      const contactParts = [c.email, c.phone, c.location, c.linkedin, c.github, c.website].filter(
        (p) => p && String(p).trim()
      );
      if (contactParts.length) {
        const line = contactParts.join('  ·  ');
        const ch = textHeight(line, 9, pageWidth, { align: 'center' });
        checkNewPage(ch + 10);
        doc.font('Helvetica').fontSize(9).fillColor('#333333');
        doc.text(line, left, y, { width: pageWidth, align: 'center', lineGap: 0 });
        y += ch + 12;
      }

      if (structured.summary) {
        sectionRule('Summary');
        writeBlock(structured.summary, { fontSize: 10, after: 8, lineGap: 3 });
      }

      if (structured.experience?.length) {
        sectionRule('Experience');
        for (const ex of structured.experience) {
          const hasBody =
            (ex.title || ex.company) || (ex.bullets && ex.bullets.length);
          if (!hasBody) continue;

          const titleLine = [ex.title, ex.company].filter(Boolean).join(' — ');
          if (titleLine) {
            checkNewPage(20);
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111');
            const meta = [ex.location, ex.dates].filter(Boolean).join('  ·  ');
            const titleW = meta ? pageWidth - 120 : pageWidth;
            const th = textHeight(titleLine, 11, titleW, { bold: true });
            checkNewPage(th + 2);
            doc.text(titleLine, left, y, { width: titleW, lineGap: 0 });
            if (meta) {
              doc.font('Helvetica').fontSize(9).fillColor('#444444');
              doc.text(meta, left + pageWidth - 118, y, { width: 118, align: 'right', lineGap: 0 });
            }
            y += th + 2;
          } else if (ex.dates || ex.location) {
            writeBlock([ex.location, ex.dates].filter(Boolean).join('  ·  '), {
              fontSize: 9,
              color: '#444444',
              after: 4
            });
          }

          for (const bullet of ex.bullets || []) {
            if (!bullet || !String(bullet).trim()) continue;
            const b = String(bullet).trim();
            const bulletIndent = 12;
            const bw = pageWidth - bulletIndent;
            const bulletText = '•  ' + b;
            const bh = textHeight(bulletText, 10, bw);
            checkNewPage(bh + 3);
            doc.font('Helvetica').fontSize(10).fillColor('#222222');
            doc.text(bulletText, left + bulletIndent, y, { width: bw, lineGap: 2 });
            y += bh + 3;
          }
          y += 6;
        }
      }

      if (structured.education?.length) {
        sectionRule('Education');
        for (const ed of structured.education) {
          const top = [ed.degree, ed.school].filter(Boolean).join(' — ');
          if (!top && !ed.details) continue;
          if (top) {
            const meta = [ed.location, ed.dates].filter(Boolean).join('  ·  ');
            const titleW = meta ? pageWidth - 110 : pageWidth;
            const th = textHeight(top, 11, titleW, { bold: true });
            checkNewPage(th + 2);
            doc.font('Helvetica-Bold').fontSize(11).fillColor('#111111');
            doc.text(top, left, y, { width: titleW, lineGap: 0 });
            if (meta) {
              doc.font('Helvetica').fontSize(9).fillColor('#444444');
              doc.text(meta, left + pageWidth - 108, y, { width: 108, align: 'right' });
            }
            y += th + 2;
          }
          if (ed.details) {
            writeBlock(ed.details, { fontSize: 10, after: 6 });
          }
          y += 4;
        }
      }

      const skills = structured.skills;
      if (skills?.length) {
        sectionRule('Skills');
        if (typeof skills[0] === 'string') {
          writeBlock(skills.join(', '), { fontSize: 10, after: 8, lineGap: 2 });
        } else {
          for (const g of skills) {
            if (!g || typeof g !== 'object') continue;
            const label = (g.label || '').trim();
            const items = Array.isArray(g.items) ? g.items.filter(Boolean) : [];
            if (label && items.length) {
              const line = `${label}: ${items.join(', ')}`;
              writeBlock(line, { fontSize: 10, bold: false, after: 5 });
            } else if (items.length) {
              writeBlock(items.join(', '), { fontSize: 10, after: 5 });
            }
          }
        }
      }

      if (structured.certifications?.length) {
        sectionRule('Certifications');
        for (const cert of structured.certifications) {
          const row = [cert.name, cert.issuer, cert.date].filter(Boolean).join(' — ');
          if (row) writeBlock('•  ' + row, { fontSize: 10, after: 4 });
        }
      }

      if (structured.projects?.length) {
        sectionRule('Projects');
        for (const pr of structured.projects) {
          if (pr.name) writeBlock(pr.name, { fontSize: 11, bold: true, after: 3 });
          if (pr.description) writeBlock(pr.description, { fontSize: 10, after: 4 });
          for (const b of pr.bullets || []) {
            if (!b || !String(b).trim()) continue;
            writeBlock('•  ' + String(b).trim(), { fontSize: 10, after: 3, x: left + 12, width: pageWidth - 12 });
          }
          y += 4;
        }
      }

      doc.end();
    } catch (error) {
      reject(new Error(`Failed to generate PDF: ${error.message}`));
    }
  });
};

/**
 * Professional resume PDF: HTML template (default) or PDFKit via RESUME_PDF_ENGINE=pdfkit.
 * @param {import('./resumeStructured').StructuredResume} structured
 * @returns {Promise<Buffer>}
 */
const generateStructuredResumePDF = async (structured) => {
  if (process.env.RESUME_PDF_ENGINE === 'pdfkit') {
    return generateStructuredResumePDFKit(structured);
  }
  try {
    return await generateStructuredResumePDFHtml(structured);
  } catch (err) {
    console.warn('[resume PDF] HTML/Chromium path failed, using PDFKit:', err.message);
    return generateStructuredResumePDFKit(structured);
  }
};

/**
 * Generate PDF: prefers structured resume object; falls back to plain string.
 * @param {string|import('./resumeStructured').StructuredResume} input
 * @returns {Promise<Buffer>}
 */
const generateATSFriendlyPDF = async (input) => {
  if (input && typeof input === 'object' && input.contact) {
    return generateStructuredResumePDF(input);
  }
  if (typeof input === 'string') {
    return generateATSFriendlyPDFFromPlainText(input);
  }
  throw new Error('Invalid resume input for PDF generation');
};

/**
 * Format resume text for legacy plain-text PDF path
 * @param {String} text
 * @returns {String}
 */
const formatResumeText = (text) => {
  let formatted = text
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\n([A-Z][A-Z\s]{2,30})\n/g, '\n\n$1\n\n')
    .replace(/[•·▪▫]/g, '•')
    .trim();

  return formatted;
};

module.exports = {
  generateATSFriendlyPDF,
  generateATSFriendlyPDFFromPlainText,
  generateStructuredResumePDF,
  generateStructuredResumePDFKit,
  generateStructuredResumePDFHtml,
  formatResumeText
};
