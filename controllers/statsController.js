const Job = require('../models/Job');
const mongoose = require('mongoose');

// Get stats
const getStats = async (req, res) => {
  try {
    let userId = req.query.userId || 'demo-user';
    
    // Handle "demo-user" by querying for null userId
    if (userId === 'demo-user' || userId === '') {
      userId = null;
    } else if (userId && !mongoose.Types.ObjectId.isValid(userId)) {
      // If it's not a valid ObjectId, treat as demo
      userId = null;
    }
    
    // Build query - if userId is null, find jobs with null userId
    const query = userId ? { userId } : { userId: null };
    
    const total = await Job.countDocuments(query);
    const pending = await Job.countDocuments({ ...query, status: 'pending' });
    const applied = await Job.countDocuments({ ...query, status: 'applied' });
    const response = await Job.countDocuments({ ...query, status: 'response' });

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
