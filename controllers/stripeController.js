const stripeService = require('../services/stripeService');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { createCommissionForReferredUser } = require('../utils/affiliateCommission');
const { sendAccountActivatedWelcomeEmail } = require('../utils/emailService');
const { getAddonByPlanName } = require('../utils/addonCatalog');

const paymentSuccessRedirect = () =>
  `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`;
const paymentFailureRedirect = () =>
  `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/failure`;

/**
 * Send account activation welcome + invoice once per payment.
 * Reuses receiptEmailSentAt for idempotency with existing data.
 */
async function sendReceiptIfNeeded(payment) {
  try {
    if (payment.receiptEmailSentAt) return;
    const user = await User.findById(payment.userId).select('email name');
    const to = payment.metadata?.customerEmail || user?.email;
    if (!to) {
      console.warn('[stripe] payment receipt skipped: no email', payment._id?.toString?.());
      return;
    }
    const result = await sendAccountActivatedWelcomeEmail({
      to,
      recipientName: payment.metadata?.customerName || user?.name,
      amount: payment.amount,
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
      await payment.save();
    }
  } catch (e) {
    console.error('[stripe] sendReceiptIfNeeded:', e.message);
  }
}

/**
 * Create Stripe Payment Intent
 * POST /api/payments/stripe/create-payment-intent
 */
const createStripePaymentIntent = async (req, res) => {
  try {
    const {
      amount: amountRaw,
      customerInfo,
      planName,
      billingPeriod
    } = req.body;

    let amount = Number(amountRaw);

    // Validate required fields
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be greater than 0'
      });
    }

    if (!customerInfo || !customerInfo.name || !customerInfo.email) {
      return res.status(400).json({
        success: false,
        message: 'Customer name and email are required'
      });
    }

    const user = await User.findById(req.userId);
    const mainPlans = ['Starter', 'Standard', 'Pro', 'Premium'];
    const addonDef = getAddonByPlanName(planName);
    const isValidMainPlan = mainPlans.includes(planName);
    if (!addonDef && !isValidMainPlan) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan or add-on product'
      });
    }
    const isAddonPurchase = !!addonDef;

    if (isAddonPurchase) {
      const expectedAud = addonDef.amountAud;
      if (Math.round(amount * 100) !== Math.round(expectedAud * 100)) {
        return res.status(400).json({
          success: false,
          message: 'Amount does not match the selected add-on'
        });
      }
      const hasThisAddon = user?.purchasedAddons?.some((a) => a.name === addonDef.storageName);
      if (hasThisAddon) {
        return res.status(400).json({
          success: false,
          message: 'You already have this add-on'
        });
      }
    } else if (user && user.subscription && user.subscription.planName) {
      const now = new Date();
      const isExpired = user.subscription.endDate && new Date(user.subscription.endDate) < now;
      if (!isExpired && user.subscription.status === 'active') {
        return res.status(400).json({
          success: false,
          message: `You already have an active plan (${user.subscription.planName}). Please wait for it to expire or contact support to upgrade.`
        });
      }
    }

    // Premium: charge A$1 for live card testing (mirrors pricing page). Server-side so amount cannot be spoofed.
    const PREMIUM_CHECKOUT_AMOUNT_AUD = 1;
    if (planName === 'Premium') {
      amount = PREMIUM_CHECKOUT_AMOUNT_AUD;
    }

    // Validate amount limits
    if (amount < 1 || amount > 50000) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between $1 and $50,000'
      });
    }

    // Create Stripe payment intent (AUD — matches Plan.currency and pricing)
    const stripeOrderData = {
      amount,
      currency: 'aud',
      customerInfo,
      planName,
      billingPeriod,
      orderId: `plan_${Date.now()}_${req.user._id}`
    };

    const stripeResult = await stripeService.createPaymentIntent(stripeOrderData);

    if (!stripeResult.success) {
      console.error('❌ Stripe payment intent creation failed:', stripeResult.message);
      console.error('❌ Error details:', JSON.stringify(stripeResult.error, null, 2));
      
      // Return appropriate status code based on error type
      const statusCode = stripeResult.error?.type === 'StripeAuthenticationError' ? 401 : 500;
      
      return res.status(statusCode).json({
        success: false,
        message: stripeResult.message || 'Failed to create Stripe payment intent',
        error: process.env.NODE_ENV === 'development' 
          ? stripeResult.error
          : (stripeResult.error?.type === 'StripeAuthenticationError' 
              ? 'Authentication failed. Please check Stripe credentials.'
              : 'Failed to create payment intent')
      });
    }

    // Create payment record in database
    const payment = new Payment({
      userId: req.user._id,
      transactionId: stripeResult.data.id,
      merchantTransactionId: stripeResult.data.metadata.receipt,
      amount: amount,
      currency: stripeResult.data.currency.toUpperCase(),
      status: 'PENDING',
      paymentMethod: 'CARD',
      gateway: 'STRIPE',
      stripePaymentIntentId: stripeResult.data.id,
      paymentResponse: stripeResult.data,
      planName: planName,
      billingPeriod: billingPeriod,
      metadata: {
        customerName: customerInfo.name,
        customerEmail: customerInfo.email,
        customerPhone: customerInfo.phone || '',
        redirectUrl: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`
      }
    });

    await payment.save();

    // Prepare response data
    const responseData = {
      payment_intent_id: stripeResult.data.id,
      client_secret: stripeResult.client_secret,
      amount: stripeResult.data.amount / 100, // Convert from cents to dollars
      currency: stripeResult.data.currency.toUpperCase(),
      payment_id: payment._id
    };

    res.json({
      success: true,
      message: 'Stripe payment intent created successfully',
      data: responseData
    });

  } catch (error) {
    console.error('❌ Error creating Stripe payment intent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Stripe payment intent',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Dev/Test: Fake payment - bypasses Stripe for development testing
 * Only enabled when NODE_ENV=development OR ENABLE_DEV_FAKE_PAYMENT=true
 * POST /api/payments/stripe/dev-fake-payment
 */
const devFakePayment = async (req, res) => {
  const isDevMode = process.env.NODE_ENV === 'development' || process.env.ENABLE_DEV_FAKE_PAYMENT === 'true';
  if (!isDevMode) {
    return res.status(403).json({
      success: false,
      message: 'Dev fake payment is only available in development mode'
    });
  }

  try {
    const { planName } = req.body;
    const userId = req.userId;

    if (!planName) {
      return res.status(400).json({
        success: false,
        message: 'planName is required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const mainPlans = ['Starter', 'Standard', 'Pro', 'Premium'];
    const addonDef = getAddonByPlanName(planName);
    const isAddonPurchase = !!addonDef;

    if (!isAddonPurchase && !mainPlans.includes(planName)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid plan or add-on product'
      });
    }

    if (!isAddonPurchase) {
      if (user.subscription?.planName && user.subscription?.status === 'active') {
        const isExpired = user.subscription?.endDate && new Date(user.subscription.endDate) < new Date();
        if (!isExpired) {
          return res.status(400).json({
            success: false,
            message: `You already have an active plan (${user.subscription.planName})`
          });
        }
      }
    } else {
      const hasAddon = user.purchasedAddons?.some((a) => a.name === addonDef.storageName);
      if (hasAddon) {
        return res.status(400).json({
          success: false,
          message: 'You already have this add-on'
        });
      }
    }

    const fakePaymentId = `dev_fake_${Date.now()}_${userId}`;
    const payment = new Payment({
      userId,
      transactionId: fakePaymentId,
      merchantTransactionId: fakePaymentId,
      amount: isAddonPurchase ? addonDef.amountAud : 1,
      currency: 'AUD',
      status: 'SUCCESS',
      paymentMethod: 'CARD',
      gateway: 'STRIPE',
      stripePaymentIntentId: fakePaymentId,
      planName,
      billingPeriod: 'onetime',
      completedAt: new Date(),
      metadata: { customerName: user.name, customerEmail: user.email, devFake: true }
    });
    await payment.save();

    if (isAddonPurchase) {
      user.purchasedAddons = user.purchasedAddons || [];
      user.purchasedAddons.push({ name: addonDef.storageName, purchasedAt: new Date() });
    } else {
      user.subscription = {
        planName,
        billingPeriod: 'onetime',
        startDate: new Date(),
        endDate: null,
        status: 'active',
        paymentId: payment._id
      };
    }
    await user.save();
    await createCommissionForReferredUser(payment);

    res.json({
      success: true,
      message: 'Dev fake payment completed',
      data: {
        payment_intent_id: fakePaymentId,
        planName,
        billingPeriod: 'onetime'
      }
    });
  } catch (error) {
    console.error('Dev fake payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Dev fake payment failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * Verify Stripe Payment
 * POST /api/payments/stripe/verify
 */
const verifyStripePayment = async (req, res) => {
  try {
    const {
      payment_intent_id
    } = req.body;

    // Validate required fields
    if (!payment_intent_id) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID is required',
        redirect_url: paymentFailureRedirect()
      });
    }

    // Dev fake payment - skip Stripe, return success (user already updated)
    if (payment_intent_id.startsWith('dev_fake_')) {
      const payment = await Payment.findOne({
        stripePaymentIntentId: payment_intent_id,
        gateway: 'STRIPE'
      });
      if (!payment || payment.status !== 'SUCCESS') {
        return res.status(400).json({
          success: false,
          message: 'Dev fake payment not found or invalid',
          redirect_url: paymentFailureRedirect()
        });
      }
      await sendReceiptIfNeeded(payment);
      return res.json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          payment_intent_id: payment_intent_id,
          status: 'SUCCESS',
          planName: payment.planName,
          billingPeriod: payment.billingPeriod
        },
        redirect_url: paymentSuccessRedirect()
      });
    }

    // Retrieve payment intent from Stripe
    const stripeResult = await stripeService.getPaymentIntent(payment_intent_id);

    if (!stripeResult.success) {
      return res.status(400).json({
        success: false,
        message: stripeResult.message || 'Payment verification failed',
        redirect_url: paymentFailureRedirect()
      });
    }

    const paymentIntent = stripeResult.data;

    // Check payment status
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        message: `Payment status is ${paymentIntent.status}. Payment must be succeeded.`,
        payment_status: paymentIntent.status,
        redirect_url: paymentFailureRedirect()
      });
    }

    // Find the payment record
    const payment = await Payment.findOne({ 
      stripePaymentIntentId: payment_intent_id,
      gateway: 'STRIPE'
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found',
        redirect_url: paymentFailureRedirect()
      });
    }

    const responseData = {
      payment_intent_id: payment_intent_id,
      status: 'SUCCESS',
      planName: payment.planName,
      billingPeriod: payment.billingPeriod
    };

    // Idempotent: already verified — skip duplicate user updates; retry receipt email if needed
    if (payment.status === 'SUCCESS') {
      await sendReceiptIfNeeded(payment);
      return res.json({
        success: true,
        message: 'Payment verified successfully',
        data: responseData,
        redirect_url: paymentSuccessRedirect()
      });
    }

    // Update payment record with verification details
    payment.status = 'SUCCESS';
    payment.stripePaymentId = paymentIntent.latest_charge || payment_intent_id;
    payment.paymentResponse = {
      ...payment.paymentResponse,
      verification: {
        status: paymentIntent.status,
        payment_method: paymentIntent.payment_method,
        charges: paymentIntent.charges
      }
    };
    payment.completedAt = new Date();
    await payment.save();

    // Update user subscription or add-on
    if (payment.planName) {
      try {
        const user = await User.findById(payment.userId);
        if (user) {
          const mainPlans = ['Starter', 'Standard', 'Pro', 'Premium'];
          const addonDef = getAddonByPlanName(payment.planName);
          const isAddon = !!addonDef;

          if (isAddon) {
            const addonName = addonDef.storageName;
            const hasAddon = user.purchasedAddons?.some(a => a.name === addonName);
            if (!hasAddon) {
              user.purchasedAddons = user.purchasedAddons || [];
              user.purchasedAddons.push({ name: addonName, purchasedAt: new Date() });
              await user.save();
            }
          } else if (mainPlans.includes(payment.planName)) {
            // Main plan subscription only — unknown planName must not write invalid subscription
            let endDate = null;
            if (payment.billingPeriod === 'quarterly') {
              endDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
            } else if (payment.billingPeriod === 'monthly') {
              endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
            }
            user.subscription = {
              planName: payment.planName,
              billingPeriod: payment.billingPeriod,
              startDate: new Date(),
              endDate: endDate,
              status: 'active',
              paymentId: payment._id
            };
            await user.save();
          } else {
            console.warn('[stripe] verify: payment planName is not a main plan or catalog add-on:', payment.planName);
          }
        }
        await createCommissionForReferredUser(payment);
      } catch (userError) {
        console.error('Error updating user subscription:', userError);
      }
    }

    await sendReceiptIfNeeded(payment);

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: responseData,
      redirect_url: paymentSuccessRedirect()
    });

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      redirect_url: paymentFailureRedirect()
    });
  }
};

/**
 * Get Payment Status
 * GET /api/payments/stripe/status/:paymentIntentId
 */
const getStripePaymentStatus = async (req, res) => {
  try {
    const { paymentIntentId } = req.params;

    if (!paymentIntentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment intent ID is required'
      });
    }

    // Try to get payment details from Stripe
    const stripeResult = await stripeService.getPaymentIntent(paymentIntentId);

    if (!stripeResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found or failed to fetch details'
      });
    }

    // Also get payment record from database
    const payment = await Payment.findOne({ 
      stripePaymentIntentId: paymentIntentId,
      gateway: 'STRIPE'
    });

    res.json({
      success: true,
      data: {
        payment_status: stripeResult.data.status,
        payment_method: stripeResult.data.payment_method_types,
        amount: stripeResult.data.amount / 100, // Convert from cents
        currency: stripeResult.data.currency.toUpperCase(),
        created_at: new Date(stripeResult.data.created * 1000),
        database_status: payment ? payment.status : 'not_found'
      }
    });

  } catch (error) {
    console.error('❌ Error fetching payment status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Check Stripe Configuration
 * GET /api/payments/stripe/config
 */
const checkStripeConfig = async (req, res) => {
  try {
    const configResult = stripeService.validateConfiguration();

    res.json({
      success: configResult.success,
      message: configResult.success ? 'Stripe is configured' : 'Stripe configuration is incomplete',
      data: {
        secretKey: configResult.secretKey,
        publishableKey: configResult.publishableKey,
        missingVars: configResult.missingVars || []
      }
    });

  } catch (error) {
    console.error('❌ Error checking Stripe configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  createStripePaymentIntent,
  verifyStripePayment,
  getStripePaymentStatus,
  checkStripeConfig,
  devFakePayment
};

