const Affiliate = require('../models/Affiliate');
const AffiliateClick = require('../models/AffiliateClick');
const AffiliateCommission = require('../models/AffiliateCommission');

/**
 * List all affiliates (super admin only)
 * GET /api/employee/affiliates
 */
const listAffiliates = async (req, res) => {
  try {
    const affiliates = await Affiliate.find().select('-password').lean();
    const result = await Promise.all(affiliates.map(async (aff) => {
      const totalClicks = await AffiliateClick.countDocuments({ affiliateId: aff._id });
      const commissions = await AffiliateCommission.find({ affiliateId: aff._id }).lean();
      const totalCommission = commissions.reduce((sum, c) => sum + c.amount, 0);
      const unpaidAmount = commissions.filter(c => c.status === 'pending').reduce((sum, c) => sum + c.amount, 0);
      const paidAmount = commissions.filter(c => c.status === 'paid').reduce((sum, c) => sum + c.amount, 0);
      const hasUnpaid = unpaidAmount > 0;
      return {
        id: aff._id,
        name: aff.name,
        email: aff.email,
        referralCode: aff.referralCode,
        status: aff.status,
        totalClicks,
        totalSuccessfulClosures: commissions.length,
        totalCommission,
        unpaidAmount,
        paidAmount,
        commissionStatus: hasUnpaid ? 'Unpaid' : 'Paid',
        createdAt: aff.createdAt
      };
    }));
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('List affiliates error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch affiliates' });
  }
};

/**
 * Mark affiliate commissions as paid
 * PATCH /api/employee/affiliates/:id/mark-paid
 */
const markCommissionsPaid = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await AffiliateCommission.updateMany(
      { affiliateId: id, status: 'pending' },
      { status: 'paid', paidAt: new Date() }
    );
    res.json({
      success: true,
      message: `${result.modifiedCount} commission(s) marked as paid`
    });
  } catch (error) {
    console.error('Mark paid error:', error);
    res.status(500).json({ success: false, error: 'Failed to update commissions' });
  }
};

module.exports = {
  listAffiliates,
  markCommissionsPaid
};
