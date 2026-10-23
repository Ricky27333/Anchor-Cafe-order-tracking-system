const mongoose = require('mongoose');

const OrderItemSchema = new mongoose.Schema({
  menuItemId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'MenuItem',
    required: false
  },
  sku: { type: String, default: '' },
  title: { type: String, required: true },
  category: { type: String, required: true },
  variant: { type: String, default: null }, // 'Milkshake', 'Blended', 'Thickshake'
  unitPrice: { type: Number, required: true }, // The charm price charged
  quantity: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true },
  specialInstructions: { type: String, default: '' }
}, { _id: false });

const OrderSchema = new mongoose.Schema({
  orderNumber: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  }, // e.g. "AC-20261022-0042"
  dailySequence: { 
    type: Number, 
    required: true 
  }, // Sequential daily counter: 1, 2, 3...
  orderType: { 
    type: String, 
    enum: ['DINE_IN', 'BEACH_SHORE_SERVICE', 'TAKEAWAY', 'EVENT_CUSTOM'],
    default: 'DINE_IN',
    index: true
  },
  locationDetails: {
    tableNumber: { type: String, default: '' }, // e.g. "Deck Table 4"
    beachSpot: { type: String, default: '' }, // e.g. "Beach Umbrella 2 / Waterline"
    customerName: { type: String, default: 'Guest' },
    customerPhone: { type: String, default: '' }
  },
  items: [OrderItemSchema],
  totalItemCount: { type: Number, required: true, default: 0 },
  subtotalAmount: { type: Number, required: true, default: 0 },
  discountAmount: { type: Number, default: 0 },
  finalTotalAmount: { type: Number, required: true, default: 0 },
  
  orderStatus: {
    type: String,
    enum: ['PENDING', 'ACCEPTED', 'KITCHEN_PREPARING', 'READY_FOR_PICKUP', 'SERVED', 'CANCELLED'],
    default: 'PENDING',
    index: true
  },
  
  paymentStatus: {
    type: String,
    enum: ['UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED'],
    default: 'UNPAID',
    index: true
  },
  
  paymentMethod: {
    type: String,
    enum: ['CASH', 'UPI_QR', 'PHONEPE', 'GPAY', 'UPI', 'CARD', 'ONLINE_WHATSAPP', 'PENDING_TAB'],
    default: 'PHONEPE'
  },
  
  timestamps: {
    placedAt: { type: Date, default: Date.now, index: true },
    acceptedAt: Date,
    kitchenStartedAt: Date,
    readyAt: Date,
    completedAt: Date
  },
  
  cashierUser: { type: String, default: 'Counter 1' },
  kitchenNotes: { type: String, default: '' }
}, { 
  timestamps: true 
});

// Pre-save calculation check
OrderSchema.pre('save', function(next) {
  let count = 0;
  let sum = 0;
  if (this.items && this.items.length > 0) {
    this.items.forEach(it => {
      count += it.quantity;
      it.subtotal = it.unitPrice * it.quantity;
      sum += it.subtotal;
    });
  }
  this.totalItemCount = count;
  this.subtotalAmount = sum;
  this.finalTotalAmount = Math.max(0, sum - (this.discountAmount || 0));
  next();
});

module.exports = mongoose.model('Order', OrderSchema);
