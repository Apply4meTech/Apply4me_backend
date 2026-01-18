// Health check controller
const healthCheck = (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Job Application Service API',
    version: '1.0.0'
  });
};

module.exports = {
  healthCheck
};
