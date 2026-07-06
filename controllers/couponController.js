const Payment = require('../models/Payment');
const User = require('../models/User');
const Coupon = require('../models/Coupon');
const { findAndValidateCoupon } = require('../utils/couponValidation');
const { activatePlanOrAddonForPayment } = require('../utils/paymentActivation');
const { sendAccountActivatedWelcomeEmail, sendChromeExtensionGuideEmail } = require('../utils/emailService');

const paymentSuccessRedirect = () =>
  `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`;

async function sendReceiptIfNeeded(payment) {
  try {
    const user = await User.findById(payment.userId).select('email name');
    const to = payment.metadata?.customerEmail || user?.email;
    if (!to) return;

    let didChangePayment = false;

    if (!payment.receiptEmailSentAt) {
      const result = await sendAccountActivatedWelcomeEmail({
        to,
        recipientName: payment.metadata?.customerName || user?.name,
        amount: payment.metadata?.amountPaid ?? payment.amount,
        currency: payment.currency || 'AUD',
        description: payment.planName
          ? `Apply for Me - ${payment.planName} plan`
          : 'Apply for Me plan activation',
        paymentReference: payment.stripePaymentIntentId,
        completedAt: payment.completedAt || new Date(),
        invoiceSeed: payment._id?.toString?.(),
        invoiceDate: payment.completedAt || new Date()
      });
      if (result.sent) {
        if (result.invoiceUpload) {
          payment.invoiceDocument = {
            fileName: result.invoiceUpload.fileName,
            fileSize: result.invoiceUpload.fileSize,
            resourceId: result.invoiceUpload.resourceId,
            url: result.invoiceUpload.url,
            key: result.invoiceUpload.key,
            bucket: result.invoiceUpload.bucket,
            mimeType: result.invoiceUpload.mimeType,
            uploadedAt: result.invoiceUpload.uploadedAt
              ? new Date(result.invoiceUpload.uploadedAt)
              : new Date()
          };
        }
        payment.receiptEmailSentAt = new Date();
        didChangePayment = true;
      }
    }

    if (!payment.chromeGuideEmailSentAt) {
      const guideResult = await sendChromeExtensionGuideEmail({
        to,
        recipientName: payment.metadata?.customerName || user?.name
      });
      if (guideResult.sent) {
        payment.chromeGuideEmailSentAt = new Date();
        didChangePayment = true;
      }
    }

    if (didChangePayment) {
      await payment.save();
    }
  } catch (e) {
    console.error('[coupon] sendReceiptIfNeeded:', e.message);
  }
}

/**
 * POST /api/payments/coupon/validate
 */
const validateCoupon = async (req, res) => {
  try {
    const { code, planName, payment_intent_id } = req.body;

    let resolvedPlanName = planName;
    if (!resolvedPlanName && payment_intent_id) {
      const payment = await Payment.findOne({
        stripePaymentIntentId: payment_intent_id,
        userId: req.userId
      }).select('planName amount');
      resolvedPlanName = payment?.planName;
    }

    const result = await findAndValidateCoupon(code, {
      planName: resolvedPlanName,
      userId: req.userId
    });

    if (!result.valid) {
      return res.status(400).json({ success: false, message: result.message });
    }

    const { coupon } = result;
    res.json({
      success: true,
      data: {
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        isFullDiscount: coupon.discountPercent === 100
      }
    });
  } catch (error) {
    console.error('[coupon] validate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate coupon'
    });
  }
};

/**
 * POST /api/payments/coupon/redeem
 * Redeem a 100% off coupon — skips Stripe and activates the plan.
 */
const redeemCoupon = async (req, res) => {
  try {
    const { code, payment_intent_id } = req.body;

    if (!code || !payment_intent_id) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and payment_intent_id are required'
      });
    }

    const payment = await Payment.findOne({
      stripePaymentIntentId: payment_intent_id,
      userId: req.userId
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment session not found'
      });
    }

    if (payment.status === 'SUCCESS') {
      return res.json({
        success: true,
        message: 'Plan already activated',
        data: {
          payment_intent_id,
          planName: payment.planName,
          billingPeriod: payment.billingPeriod
        },
        redirect_url: paymentSuccessRedirect()
      });
    }

    const validation = await findAndValidateCoupon(code, {
      planName: payment.planName,
      userId: req.userId
    });

    if (!validation.valid) {
      return res.status(400).json({ success: false, message: validation.message });
    }

    const { coupon } = validation;
    if (coupon.discountPercent !== 100) {
      return res.status(400).json({
        success: false,
        message: 'Only 100% off coupons can be redeemed without payment'
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const originalAmount = payment.amount;
    payment.status = 'SUCCESS';
    payment.paymentMethod = 'COUPON';
    payment.completedAt = new Date();
    payment.metadata = {
      ...payment.metadata,
      couponCode: coupon.code,
      originalAmount,
      amountPaid: 0
    };
    payment.amount = 0;
    await payment.save();

    await Coupon.updateOne({ _id: coupon._id }, { $inc: { usedCount: 1 } });

    await activatePlanOrAddonForPayment(user, payment);
    await sendReceiptIfNeeded(payment);

    res.json({
      success: true,
      message: 'Coupon applied successfully',
      data: {
        payment_intent_id,
        planName: payment.planName,
        billingPeriod: payment.billingPeriod,
        couponCode: coupon.code
      },
      redirect_url: paymentSuccessRedirect()
    });
  } catch (error) {
    console.error('[coupon] redeem error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to redeem coupon'
    });
  }
};

module.exports = { validateCoupon, redeemCoupon };
