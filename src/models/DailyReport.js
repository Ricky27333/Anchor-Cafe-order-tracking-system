const mongoose = require('mongoose');

const DailyReportSchema = new mongoose.Schema({
  reportDate: { 
    type: String, 
    required: true, 
    unique: true, 
    index: true 
  }, // Format: "YYYY-MM-DD" e.g. "2026-10-22"
  totalGrossSales: { type: Number, required: true, default: 0 },
  totalNetSales: { type: Number, required: true, default: 0 },
  totalDiscountGiven: { type: Number, default: 0 },
  totalOrderCount: { type: Number, required: true, default: 0 },
  completedOrdersCount: { type: Number, default: 0 },
  cancelledOrdersCount: { type: Number, default: 0 },
  
  // Payment Breakdown
  cashRevenue: { type: Number, default: 0 },
  upiRevenue: { type: Number, default: 0 },
  cardRevenue: { type: Number, default: 0 },
  
  // Category Sales Volume
  salesByCategory: {
    hotBeverages: { type: Number, default: 0 },
    mojitos: { type: Number, default: 0 },
    shakes: { type: Number, default: 0 },
    icecream: { type: Number, default: 0 },
    snacks: { type: Number, default: 0 },
    beachEvents: { type: Number, default: 0 }
  },
  
  // Bestselling Items of the Day
  topSoldItems: [{
    title: String,
    quantity: Number,
    revenue: Number
  }],
  
  closingCashInDrawer: { type: Number, default: 0 },
  cashDiscrepancy: { type: Number, default: 0 },
  notes: { type: String, default: '' },
  isClosed: { type: Boolean, default: false }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('DailyReport', DailyReportSchema);
