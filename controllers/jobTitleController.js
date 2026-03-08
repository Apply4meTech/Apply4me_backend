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

// ========== Super Admin CRUD (master data) ==========

// Get all job titles with full details (super admin only)
const getJobTitlesAdmin = async (req, res) => {
  try {
    const jobTitles = await JobTitle.find()
      .sort({ isDefault: -1, usageCount: -1, displayTitle: 1 })
      .lean();

    res.json({ success: true, data: jobTitles });
  } catch (error) {
    console.error('Error fetching job titles (admin):', error);
    res.status(500).json({ success: false, error: 'Failed to fetch job titles' });
  }
};

// Create job title (super admin only)
const createJobTitleAdmin = async (req, res) => {
  try {
    const { title, displayTitle, isDefault } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ success: false, error: 'Job title is required' });
    }

    const trimmedTitle = title.trim();
    const titleLower = trimmedTitle.toLowerCase();
    const display = (displayTitle && displayTitle.trim()) || trimmedTitle;

    const existing = await JobTitle.findOne({ title: titleLower });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Job title already exists' });
    }

    const newJobTitle = await JobTitle.create({
      title: titleLower,
      displayTitle: display,
      isDefault: Boolean(isDefault),
      usageCount: 0
    });

    res.status(201).json({
      success: true,
      data: newJobTitle,
      message: 'Job title created successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Job title already exists' });
    }
    console.error('Error creating job title:', error);
    res.status(500).json({ success: false, error: 'Failed to create job title' });
  }
};

// Update job title (super admin only)
const updateJobTitleAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, displayTitle, isDefault } = req.body;

    const jobTitle = await JobTitle.findById(id);
    if (!jobTitle) {
      return res.status(404).json({ success: false, error: 'Job title not found' });
    }

    if (title !== undefined && title !== null) {
      const trimmedTitle = title.trim();
      if (!trimmedTitle) {
        return res.status(400).json({ success: false, error: 'Job title cannot be empty' });
      }
      const titleLower = trimmedTitle.toLowerCase();
      const duplicate = await JobTitle.findOne({ title: titleLower, _id: { $ne: id } });
      if (duplicate) {
        return res.status(400).json({ success: false, error: 'Job title already exists' });
      }
      jobTitle.title = titleLower;
      jobTitle.displayTitle = trimmedTitle;
    }

    if (displayTitle !== undefined && displayTitle !== null) {
      jobTitle.displayTitle = displayTitle.trim() || jobTitle.displayTitle;
    }
    if (typeof isDefault === 'boolean') {
      jobTitle.isDefault = isDefault;
    }

    await jobTitle.save();

    res.json({
      success: true,
      data: jobTitle,
      message: 'Job title updated successfully'
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, error: 'Job title already exists' });
    }
    console.error('Error updating job title:', error);
    res.status(500).json({ success: false, error: 'Failed to update job title' });
  }
};

// Delete job title (super admin only)
const deleteJobTitleAdmin = async (req, res) => {
  try {
    const { id } = req.params;

    const jobTitle = await JobTitle.findByIdAndDelete(id);
    if (!jobTitle) {
      return res.status(404).json({ success: false, error: 'Job title not found' });
    }

    res.json({
      success: true,
      message: 'Job title deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting job title:', error);
    res.status(500).json({ success: false, error: 'Failed to delete job title' });
  }
};

module.exports = {
  getJobTitles,
  addJobTitle,
  getJobTitlesAdmin,
  createJobTitleAdmin,
  updateJobTitleAdmin,
  deleteJobTitleAdmin
};
