const Razorpay = require('razorpay');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class RazorpayService {
  constructor() {
    // Validate environment variables
    if (!process.env.RAZORPAY_KEY_ID) {
      throw new Error('RAZORPAY_KEY_ID is not set in environment variables');
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
      throw new Error('RAZORPAY_KEY_SECRET is not set in environment variables');
    }

    // Initialize Razorpay instance
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }

  /**
   * Generate unique receipt ID for orders
   */
  generateReceiptId() {
    return `receipt_${Date.now()}_${uuidv4().substring(0, 8)}`;
  }

  /**
   * Create a Razorpay order
   * @param {Object} orderData - Order data
   * @returns {Object} Order creation result
   */
  async createOrder(orderData) {
    try {
      const {
        amount,
        currency = 'INR',
        customerInfo,
        orderItems = [],
        orderId
      } = orderData;

      // Validate required fields
      if (!amount || amount <= 0) {
        throw new Error('Amount must be greater than 0');
      }

      if (!customerInfo || !customerInfo.name || !customerInfo.email) {
        throw new Error('Customer name and email are required');
      }

      // Convert amount to paise (Razorpay expects amount in smallest currency unit)
      const amountInPaise = Math.round(amount * 100);

      // Generate unique receipt
      const receipt = this.generateReceiptId();

      // Prepare order options
      const options = {
        amount: amountInPaise,
        currency: currency,
        receipt: receipt,
        notes: {
          order_id: orderId || 'N/A',
          customer_name: customerInfo.name,
          customer_email: customerInfo.email,
          customer_phone: customerInfo.phone || '',
          plan_name: orderData.planName || '',
          billing_period: orderData.billingPeriod || '',
          created_at: new Date().toISOString()
        }
      };

      // Create order with Razorpay
      const order = await this.razorpay.orders.create(options);

      return {
        success: true,
        data: order,
        key_id: process.env.RAZORPAY_KEY_ID
      };
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      return {
        success: false,
        message: error.message || 'Failed to create Razorpay order',
        error: error
      };
    }
  }

  /**
   * Verify payment signature
   * @param {Object} paymentData - Payment data with signature
   * @returns {Object} Verification result
   */
  verifyPayment(paymentData) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = paymentData;

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return {
          success: false,
          message: 'Missing required payment verification parameters'
        };
      }

      // Create signature
      const generated_signature = crypto
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      // Verify signature
      if (generated_signature === razorpay_signature) {
        return {
          success: true,
          message: 'Payment signature verified successfully',
          data: {
            order_id: razorpay_order_id,
            payment_id: razorpay_payment_id,
            signature: razorpay_signature
          }
        };
      } else {
        return {
          success: false,
          message: 'Payment signature verification failed'
        };
      }
    } catch (error) {
      console.error('Error verifying payment:', error);
      return {
        success: false,
        message: 'Payment verification failed',
        error: error.message
      };
    }
  }

  /**
   * Get payment details
   * @param {string} paymentId - Payment ID
   * @returns {Object} Payment details
   */
  async getPaymentDetails(paymentId) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return {
        success: true,
        data: payment
      };
    } catch (error) {
      console.error('Error fetching payment details:', error);
      return {
        success: false,
        message: 'Failed to fetch payment details',
        error: error.message
      };
    }
  }

  /**
   * Get order details
   * @param {string} orderId - Order ID
   * @returns {Object} Order details
   */
  async getOrderDetails(orderId) {
    try {
      const order = await this.razorpay.orders.fetch(orderId);
      return {
        success: true,
        data: order
      };
    } catch (error) {
      console.error('Error fetching order details:', error);
      return {
        success: false,
        message: 'Failed to fetch order details',
        error: error.message
      };
    }
  }

  /**
   * Validate configuration
   */
  validateConfiguration() {
    const missingVars = [];
    if (!process.env.RAZORPAY_KEY_ID) {
      missingVars.push('RAZORPAY_KEY_ID');
    }
    if (!process.env.RAZORPAY_KEY_SECRET) {
      missingVars.push('RAZORPAY_KEY_SECRET');
    }

    return {
      success: missingVars.length === 0,
      keyId: process.env.RAZORPAY_KEY_ID ? '***' : null,
      keySecret: process.env.RAZORPAY_KEY_SECRET ? '***' : null,
      missingVars: missingVars
    };
  }
}

// Create and export a singleton instance
const razorpayService = new RazorpayService();
module.exports = razorpayService;

