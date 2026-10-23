const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  paymentTransactionId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true
  }, // e.g. "TXN-20261022-9982"
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Order', 
    required: true, 
    index: true 
  },
  orderNumber: { 
    type: String, 
    required: true,
    index: true 
  },
  amountReceived: { 
    type: Number, 
    required: true, 
    min: 0 
  },
  paymentMethod: { 
    type: String, 
    enum: ['CASH', 'PHONEPE', 'GPAY', 'PAYTM', 'UPI', 'UPI_PHONEPE', 'UPI_GPAY', 'UPI_PAYTM', 'UPI_QR', 'POS_CARD', 'CARD', 'CUSTOMER_TAB'], 
    required: true, 
    index: true 
  },
  upiReferenceNumber: { 
    type: String, 
    default: '' 
  }, // 12-digit UPI reference ID
  cashTendered: { 
    type: Number, 
    default: 0 
  }, // For cash transactions
  changeReturned: { 
    type: Number, 
    default: 0 
  },
  status: { 
    type: String, 
    enum: ['SUCCESS', 'FAILED', 'PENDING_VERIFICATION', 'REFUNDED'], 
    default: 'SUCCESS',
    index: true
  },
  processedBy: { 
    type: String, 
    default: 'Cashier Counter 1' 
  },
  reconciled: { 
    type: Boolean, 
    default: false 
  } // Day end audit flag
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Payment', PaymentSchema);
