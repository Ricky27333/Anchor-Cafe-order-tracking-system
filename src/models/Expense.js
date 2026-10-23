const mongoose = require('mongoose');

const ExpenseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  }, // e.g. "Heritage Milk 5L", "Fresh Lemons & Mint", "Ice Cubes 4 Bags"
  category: {
    type: String,
    default: 'MILK_DAIRY',
    trim: true,
    index: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  deductedFrom: {
    type: String,
    enum: ['TODAYS_SALES', 'YESTERDAYS_SALES', 'PETTY_CASH'],
    default: 'TODAYS_SALES',
    index: true
  },
  expenseDate: {
    type: Date,
    default: Date.now,
    index: true
  },
  dateCategory: {
    type: String,
    enum: ['TODAY', 'YESTERDAY', 'CUSTOM'],
    default: 'TODAY'
  },
  recordedBy: {
    type: String,
    default: 'Cashier / Counter 1'
  },
  notes: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Expense', ExpenseSchema);
