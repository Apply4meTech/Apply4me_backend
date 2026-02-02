const razorpayService = require('../services/razorpayService');
const Payment = require('../models/Payment');
const User = require('../models/User');

/**
 * Create Razorpay Order
 * POST /api/payments/razorpay/create-order
 */
const createRazorpayOrder = async (req, res) => {
  try {
    const {
      amount,
      customerInfo,
      planName,
      billingPeriod
    } = req.body;

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

    // Validate amount limits
    if (amount < 1 || amount > 500000) {
      return res.status(400).json({
        success: false,
        message: 'Amount must be between ₹1 and ₹5,00,000'
      });
    }

    // Create Razorpay order
    const razorpayOrderData = {
      amount,
      customerInfo,
      planName,
      billingPeriod,
      orderId: `plan_${Date.now()}_${req.user._id}`
    };

    const razorpayResult = await razorpayService.createOrder(razorpayOrderData);

    if (!razorpayResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create Razorpay order',
        error: razorpayResult.message
      });
    }

    // Create payment record in database
    const payment = new Payment({
      userId: req.user._id,
      transactionId: razorpayResult.data.id,
      merchantTransactionId: razorpayResult.data.receipt,
      amount: amount,
      currency: razorpayResult.data.currency,
      status: 'PENDING',
      paymentMethod: 'RAZORPAY',
      gateway: 'RAZORPAY',
      razorpayOrderId: razorpayResult.data.id,
      paymentResponse: razorpayResult.data,
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
      order_id: razorpayResult.data.id,
      amount: razorpayResult.data.amount,
      currency: razorpayResult.data.currency,
      key_id: razorpayResult.key_id,
      receipt: razorpayResult.data.receipt,
      payment_id: payment._id
    };

    res.json({
      success: true,
      message: 'Razorpay order created successfully',
      data: responseData
    });

  } catch (error) {
    console.error('❌ Error creating Razorpay order:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create Razorpay order',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

/**
 * Verify Razorpay Payment
 * POST /api/payments/razorpay/verify
 */
const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    } = req.body;

    // Validate required fields
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: 'Missing required payment verification parameters',
        redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/failure`
      });
    }

    // Verify payment with Razorpay
    const verificationData = {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature
    };

    const verificationResult = razorpayService.verifyPayment(verificationData);

    if (!verificationResult.success) {
      return res.status(400).json({
        success: false,
        message: verificationResult.message,
        payment_id: razorpay_payment_id,
        redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/failure`
      });
    }

    // Find the payment record
    const payment = await Payment.findOne({ 
      razorpayOrderId: razorpay_order_id,
      gateway: 'RAZORPAY'
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment record not found',
        redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/failure`
      });
    }

    // Update payment record with verification details
    payment.status = 'SUCCESS';
    payment.razorpayPaymentId = razorpay_payment_id;
    payment.razorpaySignature = razorpay_signature;
    payment.paymentResponse = {
      ...payment.paymentResponse,
      verification: verificationResult.data
    };
    payment.completedAt = new Date();
    await payment.save();

    // Update user subscription/plan if needed
    if (payment.planName) {
      try {
        const user = await User.findById(payment.userId);
        if (user) {
          // Update user's plan information
          user.subscription = {
            planName: payment.planName,
            billingPeriod: payment.billingPeriod,
            startDate: new Date(),
            endDate: payment.billingPeriod === 'quarterly' 
              ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) // 90 days
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            status: 'active',
            paymentId: payment._id
          };
          await user.save();
        }
      } catch (userError) {
        console.error('Error updating user subscription:', userError);
        // Don't fail payment verification if user update fails
      }
    }

    // Prepare response data
    const responseData = {
      payment_id: razorpay_payment_id,
      order_id: razorpay_order_id,
      status: 'SUCCESS',
      planName: payment.planName,
      billingPeriod: payment.billingPeriod
    };

    res.json({
      success: true,
      message: 'Payment verified successfully',
      data: responseData,
      redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/success`
    });

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Payment verification failed',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      redirect_url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment/failure`
    });
  }
};

/**
 * Get Payment Status
 * GET /api/payments/razorpay/status/:paymentId
 */
const getRazorpayPaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;

    if (!paymentId) {
      return res.status(400).json({
        success: false,
        message: 'Payment ID is required'
      });
    }

    // Try to get payment details from Razorpay
    const razorpayResult = await razorpayService.getPaymentDetails(paymentId);

    if (!razorpayResult.success) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found or failed to fetch details'
      });
    }

    // Also get payment record from database
    const payment = await Payment.findOne({ 
      razorpayPaymentId: paymentId,
      gateway: 'RAZORPAY'
    });

    res.json({
      success: true,
      data: {
        payment_status: razorpayResult.data.status,
        payment_method: razorpayResult.data.method,
        amount: razorpayResult.data.amount,
        currency: razorpayResult.data.currency,
        created_at: razorpayResult.data.created_at,
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
 * Check Razorpay Configuration
 * GET /api/payments/razorpay/config
 */
const checkRazorpayConfig = async (req, res) => {
  try {
    const configResult = razorpayService.validateConfiguration();

    res.json({
      success: configResult.success,
      message: configResult.success ? 'Razorpay is configured' : 'Razorpay configuration is incomplete',
      data: {
        keyId: configResult.keyId,
        keySecret: configResult.keySecret,
        missingVars: configResult.missingVars || []
      }
    });

  } catch (error) {
    console.error('❌ Error checking Razorpay configuration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getRazorpayPaymentStatus,
  checkRazorpayConfig
};

