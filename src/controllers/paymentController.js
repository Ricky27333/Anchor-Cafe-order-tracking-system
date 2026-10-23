const Payment = require('../models/Payment');
const Order = require('../models/Order');
const { generateUpiQr } = require('../utils/upiGenerator');
const { emitPaymentRecorded } = require('../sockets/socketHandler');

/**
 * Generate unique transaction ID (e.g. TXN-20261022-8371)
 */
function generateTxnId() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const randomSuffix = Math.floor(1000 + Math.random() * 9000);
  return `TXN-${year}${month}${day}-${randomSuffix}`;
}

/**
 * Record a payment (Cash, Dynamic UPI, POS Card, Customer Beach Tab)
 */
async function recordPayment(req, res) {
  try {
    const {
      orderId,
      orderNumber,
      amountReceived,
      paymentMethod,
      upiReferenceNumber = '',
      cashTendered = 0,
      changeReturned = 0,
      processedBy = 'Cashier Counter 1'
    } = req.body;

    if (!orderId || !amountReceived) {
      return res.status(400).json({ success: false, message: 'orderId and amountReceived are required' });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const paymentTransactionId = generateTxnId();

    const payment = new Payment({
      paymentTransactionId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      amountReceived: Number(amountReceived),
      paymentMethod,
      upiReferenceNumber: upiReferenceNumber || `UPI-REF-${Date.now().toString().slice(-6)}`,
      cashTendered: Number(cashTendered) || Number(amountReceived),
      changeReturned: Number(changeReturned) || 0,
      status: 'SUCCESS',
      processedBy,
      reconciled: false
    });

    const savedPayment = await payment.save();

    // Update Order payment status
    order.paymentStatus = 'PAID';
    order.paymentMethod = paymentMethod.startsWith('UPI') ? 'UPI_QR' : (paymentMethod === 'POS_CARD' ? 'CARD' : 'CASH');
    await order.save();

    // Broadcast payment event via WebSocket
    emitPaymentRecorded(savedPayment, order);

    res.status(201).json({
      success: true,
      message: `Payment of ₹${amountReceived} recorded successfully for ${order.orderNumber}`,
      payment: savedPayment,
      order
    });
  } catch (error) {
    console.error('Error recording payment:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Generate dynamic UPI QR Code for instantaneous scanning
 */
async function generateOrderUpiQr(req, res) {
  try {
    const { orderId, orderNumber, amount } = req.body;

    let targetAmount = amount;
    let targetOrderNumber = orderNumber;

    if (orderId && !targetAmount) {
      const order = await Order.findById(orderId);
      if (order) {
        targetAmount = order.finalTotalAmount;
        targetOrderNumber = order.orderNumber;
      }
    }

    if (!targetAmount) {
      return res.status(400).json({ success: false, message: 'Amount or valid orderId is required' });
    }

    const qrResult = await generateUpiQr({
      amount: targetAmount,
      orderNumber: targetOrderNumber || 'AC-INSTANT'
    });

    if (!qrResult.success) {
      return res.status(500).json({ success: false, message: qrResult.error });
    }

    res.json({
      success: true,
      ...qrResult
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get all payment transactions for a given date with reconciliation breakdown
 */
async function getDailyPayments(req, res) {
  try {
    const { date } = req.params;
    const targetDate = date ? new Date(date) : new Date();

    const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0);
    const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59);

    const payments = await Payment.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ createdAt: -1 });

    let totalRevenue = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let cardTotal = 0;

    payments.forEach(p => {
      totalRevenue += p.amountReceived;
      if (p.paymentMethod === 'CASH') {
        cashTotal += p.amountReceived;
      } else if (p.paymentMethod.startsWith('UPI')) {
        upiTotal += p.amountReceived;
      } else if (p.paymentMethod === 'POS_CARD') {
        cardTotal += p.amountReceived;
      }
    });

    res.json({
      success: true,
      date: startOfDay.toISOString().split('T')[0],
      count: payments.length,
      totals: {
        totalRevenue,
        cashTotal,
        upiTotal,
        cardTotal,
        upiPercentage: totalRevenue > 0 ? Math.round((upiTotal / totalRevenue) * 100) : 0
      },
      payments
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  recordPayment,
  generateOrderUpiQr,
  getDailyPayments
};
