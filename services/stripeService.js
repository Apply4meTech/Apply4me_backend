const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');

class StripeService {
  constructor() {
    this.stripe = null;
    this.initialized = false;
    this.initialize();
  }

  initialize() {
    try {
      // Validate environment variables
      if (!process.env.STRIPE_SECRET_KEY) {
        console.error('⚠️ STRIPE_SECRET_KEY is not set in environment variables');
        return;
      }

      // Initialize Stripe instance
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      this.initialized = true;
      console.log('✅ Stripe service initialized successfully');
    } catch (error) {
      console.error('❌ Error initializing Stripe service:', error.message);
      this.initialized = false;
    }
  }

  isInitialized() {
    return this.initialized && this.stripe !== null;
  }

  /**
   * Generate unique receipt ID for orders
   */
  generateReceiptId() {
    return `receipt_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  /**
   * Create a Stripe payment intent
   * @param {Object} orderData - Order data
   * @returns {Object} Payment intent creation result
   */
  async createPaymentIntent(orderData) {
    try {
      // Check if service is initialized
      if (!this.isInitialized()) {
        return {
          success: false,
          message: 'Stripe service is not initialized. Please check STRIPE_SECRET_KEY environment variable.',
          error: 'Service not initialized'
        };
      }

      const {
        amount,
        currency = 'usd',
        customerInfo,
        planName,
        billingPeriod,
        orderId
      } = orderData;

      // Validate required fields
      if (!amount || amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      if (!customerInfo || !customerInfo.name || !customerInfo.email) {
        throw new Error('Customer name and email are required');
      }

      // Convert amount to cents (Stripe expects amount in smallest currency unit)
      const amountInCents = Math.round(amount * 100);

      // Generate unique receipt
      const receipt = this.generateReceiptId();

      // Create payment intent with Stripe
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: amountInCents,
        currency: currency.toLowerCase(),
        receipt_email: customerInfo.email,
        description: `${planName || 'Subscription'} Plan - ${billingPeriod === 'monthly' ? 'Monthly' : 'Quarterly'}`,
        metadata: {
          order_id: orderId || 'N/A',
          customer_name: customerInfo.name,
          customer_email: customerInfo.email,
          customer_phone: customerInfo.phone || '',
          plan_name: planName || '',
          billing_period: billingPeriod || '',
          receipt: receipt,
          created_at: new Date().toISOString()
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        success: true,
        data: paymentIntent,
        client_secret: paymentIntent.client_secret
      };
    } catch (error) {
      console.error('❌ Error creating Stripe payment intent:', error);
      
      // Extract detailed error information
      let errorMessage = 'Failed to create Stripe payment intent';
      let errorDetails = error;
      
      if (error.type) {
        // Stripe API error structure
        errorMessage = error.message || errorMessage;
        errorDetails = {
          type: error.type,
          code: error.code,
          message: error.message,
          param: error.param,
          decline_code: error.decline_code
        };
      } else if (error.message) {
        errorMessage = error.message;
      }

      return {
        success: false,
        message: errorMessage,
        error: errorDetails
      };
    }
  }

  /**
   * Retrieve payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @returns {Object} Payment intent details
   */
  async getPaymentIntent(paymentIntentId) {
    try {
      if (!this.isInitialized()) {
        return {
          success: false,
          message: 'Stripe service is not initialized',
          error: 'Service not initialized'
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      return {
        success: true,
        data: paymentIntent
      };
    } catch (error) {
      console.error('Error retrieving payment intent:', error);
      return {
        success: false,
        message: 'Failed to retrieve payment intent',
        error: error.message
      };
    }
  }

  /**
   * Confirm payment intent (for server-side confirmation if needed)
   * @param {string} paymentIntentId - Payment intent ID
   * @param {Object} options - Additional options
   * @returns {Object} Confirmation result
   */
  async confirmPaymentIntent(paymentIntentId, options = {}) {
    try {
      if (!this.isInitialized()) {
        return {
          success: false,
          message: 'Stripe service is not initialized',
          error: 'Service not initialized'
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, options);
      
      return {
        success: true,
        data: paymentIntent
      };
    } catch (error) {
      console.error('Error confirming payment intent:', error);
      return {
        success: false,
        message: 'Failed to confirm payment intent',
        error: error.message
      };
    }
  }

  /**
   * Validate configuration
   */
  validateConfiguration() {
    const missingVars = [];
    if (!process.env.STRIPE_SECRET_KEY) {
      missingVars.push('STRIPE_SECRET_KEY');
    }

    return {
      success: missingVars.length === 0,
      secretKey: process.env.STRIPE_SECRET_KEY ? '***' : null,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ? '***' : null,
      missingVars: missingVars
    };
  }
}

// Create and export a singleton instance
let stripeService;
try {
  stripeService = new StripeService();
} catch (error) {
  console.error('❌ Failed to initialize Stripe service:', error.message);
  // Create a dummy service that will return errors when methods are called
  stripeService = {
    initialized: false,
    isInitialized: () => false,
    createPaymentIntent: async () => ({
      success: false,
      message: 'Stripe service is not initialized. Please check environment variables.',
      error: 'Service not initialized'
    }),
    getPaymentIntent: async () => ({
      success: false,
      message: 'Stripe service is not initialized'
    }),
    confirmPaymentIntent: async () => ({
      success: false,
      message: 'Stripe service is not initialized'
    }),
    validateConfiguration: () => ({
      success: false,
      missingVars: ['STRIPE_SECRET_KEY']
    })
  };
}

module.exports = stripeService;

