const mongoose = require('mongoose');

// Settings Schema - Global application settings
const SettingsSchema = new mongoose.Schema({
  // Auto-assign settings
  autoAssignEnabled: {
    type: Boolean,
    default: true, // Enabled by default
    required: true
  },
  // Last updated by (super admin)
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    default: null
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  // Ensure only one settings document exists
  collection: 'settings'
});

// Static method to get or create settings
SettingsSchema.statics.getSettings = async function() {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ autoAssignEnabled: true });
  }
  return settings;
};

// Static method to update settings
SettingsSchema.statics.updateSettings = async function(updates, updatedBy) {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({ ...updates, updatedBy });
  } else {
    settings = await this.findOneAndUpdate(
      {},
      { ...updates, updatedBy, updatedAt: Date.now() },
      { new: true }
    );
  }
  return settings;
};

module.exports = mongoose.model('Settings', SettingsSchema);

