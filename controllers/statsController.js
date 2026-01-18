const Job = require('../models/Job');

// Get stats
const getStats = async (req, res) => {
  try {
    const userId = req.query.userId || 'demo-user';
    
    const total = await Job.countDocuments({ userId });
    const pending = await Job.countDocuments({ userId, status: 'pending' });
    const applied = await Job.countDocuments({ userId, status: 'applied' });
    const response = await Job.countDocuments({ userId, status: 'response' });

    res.json({
      success: true,
      stats: {
        total,
        pending,
        applied,
        response,
        rejected: total - pending - applied - response
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch stats' 
    });
  }
};

module.exports = {
  getStats
};
