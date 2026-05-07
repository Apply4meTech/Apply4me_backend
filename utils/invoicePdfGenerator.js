const fs = require('fs');
const os = require('os');
const path = require('path');
const PDFDocument = require('pdfkit');

function formatMoney(amount, currency = 'AUD') {
  const code = String(currency || 'AUD').toUpperCase();
  try {
    return new Intl.NumberFormat('en-AU', { style: 'currency', currency: code }).format(Number(amount) || 0);
  } catch {
    return `${code} ${(Number(amount) || 0).toFixed(2)}`;
  }
}

function formatDate(input) {
  const date = input ? new Date(input) : new Date();
  return new Intl.DateTimeFormat('en-AU', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(date);
}

function buildInvoiceNumber(seed) {
  const text = String(seed || Date.now()).replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `AFM-${text.slice(-10) || Date.now()}`;
}

function drawCell(doc, x, y, w, h, text, options = {}) {
  const {
    bold = false,
    align = 'left',
    textColor = '#111111',
    fontSize = 11,
    fillColor = null,
    strokeColor = '#d1d5db',
    padding = 10
  } = options;

  if (fillColor) {
    doc.rect(x, y, w, h).fill(fillColor);
  }
  doc.rect(x, y, w, h).strokeColor(strokeColor).lineWidth(0.7).stroke();
  doc.fillColor(textColor).font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
  doc.text(text, x + padding, y + padding, { width: w - padding * 2, align });
}

function drawRightAlignedFitText(doc, text, x, y, width, maxFontSize, minFontSize = 10) {
  let size = maxFontSize;
  doc.font('Helvetica').fontSize(size);
  while (size > minFontSize && doc.widthOfString(text) > width) {
    size -= 1;
    doc.fontSize(size);
  }
  doc.text(text, x, y, {
    width,
    align: 'right',
    lineBreak: false
  });
}

async function generateInvoicePdfToFile(data = {}) {
  const now = new Date();
  const invoiceNumber = data.invoiceNumber || buildInvoiceNumber(data.invoiceSeed || now.getTime());
  const invoiceDate = formatDate(data.invoiceDate || now);
  const description = data.description || 'Apply for Me subscription';
  const quantity = Number(data.quantity || 1);
  const amount = Number(data.amount || 0);
  const currency = data.currency || 'AUD';
  const subtotal = amount;
  const gst = Number(data.gst || 0);
  const totalPaid = Number(data.totalPaid ?? subtotal + gst);
  const customerName = data.customerName || '[Customer Name]';
  const customerAddress = data.customerAddress || '';
  const customerEmail = data.customerEmail || '[Customer Email]';
  const paymentMethod = data.paymentMethod || 'Card';
  const paymentReference = data.paymentReference || invoiceNumber;

  const outputFilePath =
    data.outputPath ||
    path.join(os.tmpdir(), `applyforme-invoice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 35, left: 35, right: 35, bottom: 35 } });
    const stream = fs.createWriteStream(outputFilePath);
    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.on('error', reject);
    doc.pipe(stream);

    const pageWidth = doc.page.width - 70;
    const left = 35;

    doc.rect(left, 45, 190, 48).fill('#1f3b75');
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(24).text('Apply', left + 10, 60, { continued: true });
    doc.font('Helvetica-Oblique').fontSize(22).text(' for Me');

    const rightHeaderX = left + pageWidth - 300;
    const rightHeaderWidth = 300;
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(34).text('TAX INVOICE', rightHeaderX, 48, {
      width: rightHeaderWidth,
      align: 'right'
    });
    drawRightAlignedFitText(doc, `Invoice Number: ${invoiceNumber}`, rightHeaderX, 94, rightHeaderWidth, 15, 10);
    drawRightAlignedFitText(doc, `Invoice Date: ${invoiceDate}`, rightHeaderX, 121, rightHeaderWidth, 15, 10);

    doc.moveTo(left, 138).lineTo(left + pageWidth, 138).strokeColor('#1f2937').lineWidth(1).stroke();

    const infoTop = 165;
    const infoHeight = 115;
    const half = pageWidth / 2;
    drawCell(
      doc,
      left,
      infoTop,
      half,
      infoHeight,
      'From:\nApply for Me\nABN: 45 207 875 824\nEmail: contactus@applyforme.com.au',
      { bold: false, fontSize: 12, fillColor: '#f3f4f6' }
    );
    const billToLines = ['Bill To:', customerName];
    if (customerAddress) billToLines.push(customerAddress);
    billToLines.push(customerEmail);

    drawCell(
      doc,
      left + half,
      infoTop,
      half,
      infoHeight,
      billToLines.join('\n'),
      { bold: false, fontSize: 12, fillColor: '#f9fafb' }
    );

    const tableTop = infoTop + infoHeight + 35;
    const col = [130, 300, 90, 140, 130];
    const scale = pageWidth / col.reduce((a, b) => a + b, 0);
    const widths = col.map((v) => v * scale);
    const rowH = 52;
    const headers = ['Date', 'Description', 'Qty', 'Unit Price', 'Amount'];

    let x = left;
    for (let i = 0; i < headers.length; i++) {
      drawCell(doc, x, tableTop, widths[i], rowH, headers[i], {
        bold: true,
        fillColor: '#1f3b75',
        textColor: '#ffffff',
        strokeColor: '#d1d5db',
        fontSize: 13
      });
      x += widths[i];
    }

    const values = [
      invoiceDate,
      description,
      String(quantity),
      formatMoney(amount, currency),
      formatMoney(amount * quantity, currency)
    ];
    x = left;
    for (let i = 0; i < values.length; i++) {
      drawCell(doc, x, tableTop + rowH, widths[i], rowH, values[i], {
        fontSize: 12
      });
      x += widths[i];
    }

    const totalsTop = tableTop + rowH * 2 + 40;
    const labelWidth = pageWidth - 190;
    const valueWidth = 190;
    const totalRows = [
      ['Subtotal', formatMoney(subtotal, currency)],
      ['GST', formatMoney(gst, currency)],
      ['Total Paid', formatMoney(totalPaid, currency)]
    ];
    totalRows.forEach((row, idx) => {
      const isFinal = idx === totalRows.length - 1;
      drawCell(doc, left, totalsTop + idx * 43, labelWidth, 43, row[0], {
        bold: isFinal,
        fillColor: isFinal ? '#e5e7eb' : null,
        fontSize: 13
      });
      drawCell(doc, left + labelWidth, totalsTop + idx * 43, valueWidth, 43, row[1], {
        bold: isFinal,
        align: 'right',
        fillColor: isFinal ? '#e5e7eb' : null,
        fontSize: 13
      });
    });

    const paymentTop = totalsTop + 165;
    doc.fillColor('#111111').font('Helvetica-Bold').fontSize(13).text('Payment Details', left, paymentTop);
    doc.font('Helvetica').fontSize(12).text(`Payment Method: ${paymentMethod}`, left, paymentTop + 26);
    doc.text(`Reference: ${paymentReference}`, left, paymentTop + 49);
    doc.moveDown();
    doc.fontSize(14).text('Thank you for your payment and for choosing Apply for Me.', left, paymentTop + 95);

    doc.end();
  });

  return {
    outputPath: outputFilePath,
    invoiceNumber
  };
}

module.exports = {
  generateInvoicePdfToFile,
  formatMoney,
  buildInvoiceNumber
};
