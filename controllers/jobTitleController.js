const JobTitle = require('../models/JobTitle');

// Get all job titles (master list) - public for signup/onboarding
const getJobTitles = async (req, res) => {
  try {
    const jobTitles = await JobTitle.find()
      .sort({ isDefault: -1, usageCount: -1, displayTitle: 1 })
      .lean();

    const titles = jobTitles.map((jt) => jt.displayTitle || jt.title);
    res.json({ success: true, jobTitles: titles });
  } catch (error) {
    console.error('Error fetching job titles:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch job titles' });
  }
};

// Add a new job title to master list (when user selects "Others" and enters custom title)
const addJobTitle = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Job title is required' });
    }

    const trimmedTitle = title.trim();
    const titleLower = trimmedTitle.toLowerCase();

    // Check if already exists (case-insensitive)
    let existing = await JobTitle.findOne({ title: titleLower });
    if (existing) {
      // Increment usage count
      existing.usageCount += 1;
      await existing.save();
      return res.json({
        success: true,
        jobTitle: existing.displayTitle || existing.title,
        message: 'Job title already exists, usage count updated'
      });
    }

    const newJobTitle = await JobTitle.create({
      title: titleLower,
      displayTitle: trimmedTitle,
      isDefault: false,
      usageCount: 1
    });

    res.status(201).json({
      success: true,
      jobTitle: newJobTitle.displayTitle || newJobTitle.title
    });
  } catch (error) {
    if (error.code === 11000) {
      // Duplicate key - race condition, fetch and return existing
      const existing = await JobTitle.findOne({ title: title.trim().toLowerCase() });
      if (existing) {
        existing.usageCount += 1;
        await existing.save();
        return res.json({ success: true, jobTitle: existing.displayTitle || existing.title });
      }
    }
    console.error('Error adding job title:', error);
    res.status(500).json({ success: false, error: 'Failed to add job title' });
  }
};

module.exports = {
  getJobTitles,
  addJobTitle
};
