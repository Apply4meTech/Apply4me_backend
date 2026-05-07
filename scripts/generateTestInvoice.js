const path = require('path');
const { generateInvoicePdfToFile } = require('../utils/invoicePdfGenerator');

async function run() {
  const outputPath = path.join(process.cwd(), 'test-invoice.pdf');
  const result = await generateInvoicePdfToFile({
    outputPath,
    invoiceSeed: 'manual-test-001',
    invoiceDate: new Date(),
    description: 'Apply for Me Premium Plan',
    quantity: 1,
    amount: 0,
    currency: 'AUD',
    gst: 0,
    totalPaid: 0,
    customerName: 'Test Customer',
    customerAddress: 'Sydney, NSW, Australia',
    customerEmail: 'test.customer@example.com',
    paymentMethod: 'Card',
    paymentReference: 'TEST-REF-001'
  });

  console.log(`Invoice generated: ${result.outputPath}`);
  console.log(`Invoice number: ${result.invoiceNumber}`);
}

run().catch((err) => {
  console.error('Failed to generate test invoice:', err);
  process.exit(1);
});
