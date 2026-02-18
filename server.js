const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
// CORS configuration - allow requests from frontend
const corsOptions = {
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Parse URL-encoded bodies (for FormData)
app.use(express.static('public')); // Serve static files

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/job_poc';

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Connected to MongoDB'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Load Swagger YAML file
const swaggerDocument = yaml.load(fs.readFileSync(path.join(__dirname, 'swagger.yaml'), 'utf8'));

// Update server URL in swagger document based on PORT
if (swaggerDocument.servers && swaggerDocument.servers.length > 0) {
  swaggerDocument.servers[0].url = `http://localhost:${PORT}`;
}

// Swagger UI Setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument, {
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'Job Application API Docs',
}));

// Import Routes
const healthRoutes = require('./routes/healthRoutes');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const jobRoutes = require('./routes/jobRoutes');
const statsRoutes = require('./routes/statsRoutes');
const employeeRoutes = require('./routes/employeeRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const fileUploadRoutes = require('./routes/fileUploadRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const profileRoutes = require('./routes/profileRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const employeeDashboardRoutes = require('./routes/employeeDashboardRoutes');
const settingsRoutes = require('./routes/settingsRoutes');
const stripeRoutes = require('./routes/stripeRoutes');
const blogRoutes = require('./routes/blogRoutes');
const newsletterRoutes = require('./routes/newsletterRoutes');
const planRoutes = require('./routes/planRoutes');
const addressRoutes = require('./routes/addressRoutes');

// Use Routes
app.use('/', healthRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/auth/employee', employeeRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/upload', fileUploadRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/employee', employeeDashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/payments/stripe', stripeRoutes);
app.use('/api/blogs', blogRoutes);
app.use('/api/newsletter', newsletterRoutes);
app.use('/api/plans', planRoutes);
app.use('/api/address', addressRoutes);

// Serve dashboard 
app.get('/dashboard', (req, res) => {
  res.sendFile(__dirname + '/dashboard.html');
});

// Start server - listen on all network interfaces (0.0.0.0) to accept external connections
const HOST = process.env.HOST || '0.0.0.0';
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
  console.log(`📊 API available at http://${HOST}:${PORT}/api/jobs`);
  console.log(`📈 Dashboard: http://${HOST}:${PORT}/dashboard`);
  console.log(`📚 Swagger API Docs: http://${HOST}:${PORT}/api-docs`);
  console.log(`🌐 External access: http://15.134.52.48:${PORT}`);
});
