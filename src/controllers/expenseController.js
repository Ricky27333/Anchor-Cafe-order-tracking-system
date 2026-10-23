const Expense = require('../models/Expense');
const Order = require('../models/Order');
const mongoose = require('mongoose');

// In-memory expenses storage fallback
const inMemoryExpenses = [];

/**
 * Get date range helper for start of day and end of day in local time
 */
function getDayRange(offsetDays = 0) {
  const now = new Date();
  const targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offsetDays);
  
  const startOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate(), 23, 59, 59, 999);
  
  return { startOfDay, endOfDay, targetDate };
}

/**
 * Record a new expense deducted from today's or yesterday's cafe sales
 */
async function recordExpense(req, res) {
  try {
    const {
      title,
      category = 'MILK_DAIRY',
      amount,
      deductedFrom = 'TODAYS_SALES',
      recordedBy = 'Counter 1',
      notes = ''
    } = req.body;

    if (!title || !amount || Number(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid expense title and positive amount.'
      });
    }

    // Determine expense date based on custom date or deduction source
    let expenseDate = req.body.expenseDate ? new Date(req.body.expenseDate) : new Date();
    let dateCategory = 'TODAY';
    if (deductedFrom === 'YESTERDAYS_SALES') {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (!req.body.expenseDate) {
        expenseDate = yesterday;
      }
      dateCategory = 'YESTERDAY';
    } else if (req.body.expenseDate) {
      dateCategory = 'CUSTOM';
    }

    const newExpense = new Expense({
      title: title.trim(),
      category,
      amount: Number(amount),
      deductedFrom,
      expenseDate,
      dateCategory,
      recordedBy,
      notes: notes.trim()
    });

    let saved;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        saved = await newExpense.save();
      } catch (e) {
        saved = newExpense.toObject ? newExpense.toObject() : newExpense;
        saved._id = saved._id || `EXP-${Date.now()}`;
        inMemoryExpenses.push(saved);
      }
    } else {
      saved = newExpense.toObject ? newExpense.toObject() : newExpense;
      saved._id = saved._id || `EXP-${Date.now()}`;
      inMemoryExpenses.push(saved);
    }

    try {
      const { syncExpenseToOracle } = require('../services/oracleSyncService');
      syncExpenseToOracle(saved).catch(() => {});
    } catch (e) {}

    // Broadcast expense update to all screens
    const { getIO } = require('../sockets/socketHandler');
    const io = getIO();
    if (io) {
      io.emit('expense:recorded', { expense: saved });
    }

    res.status(201).json({
      success: true,
      message: `Recorded ₹${saved.amount} for "${saved.title}" (Deducted from ${deductedFrom === 'YESTERDAYS_SALES' ? "Yesterday's" : "Today's"} Sales)`,
      expense: saved
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get list of recorded expenses (filterable by date=today, yesterday, all)
 */
async function getExpenses(req, res) {
  try {
    const { filter = 'all' } = req.query;
    let expenses = [];

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        let query = {};
        if (filter === 'today') {
          const { startOfDay, endOfDay } = getDayRange(0);
          query.expenseDate = { $gte: startOfDay, $lte: endOfDay };
        } else if (filter === 'yesterday') {
          const { startOfDay, endOfDay } = getDayRange(-1);
          query.expenseDate = { $gte: startOfDay, $lte: endOfDay };
        }
        expenses = await Expense.find(query).sort({ expenseDate: -1, createdAt: -1 });
      } catch (e) {
        expenses = inMemoryExpenses;
      }
    } else {
      expenses = inMemoryExpenses;
    }

    res.json({
      success: true,
      count: expenses.length,
      expenses
    });
  } catch (error) {
    res.json({
      success: true,
      count: inMemoryExpenses.length,
      expenses: inMemoryExpenses
    });
  }
}

/**
 * Get Financial Summary: Sales vs Expenses for Today & Yesterday
 */
async function getSalesVsExpensesSummary(req, res) {
  try {
    let todayGrossSales = 0;
    let todayTotalExpenses = 0;
    let todayOrdersCount = 0;
    let todayExpensesCount = 0;
    const categoryBreakdown = {};

    let yesterdayGrossSales = 0;
    let yesterdayTotalExpenses = 0;
    let yesterdayOrdersCount = 0;
    let yesterdayExpensesCount = 0;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const todayRange = getDayRange(0);
        const todayOrders = await Order.find({
          paymentStatus: 'PAID',
          createdAt: { $gte: todayRange.startOfDay, $lte: todayRange.endOfDay }
        });
        todayGrossSales = todayOrders.reduce((sum, o) => sum + (o.finalTotalAmount || 0), 0);
        todayOrdersCount = todayOrders.length;

        const todayExpenses = await Expense.find({
          $or: [
            { deductedFrom: 'TODAYS_SALES' },
            { expenseDate: { $gte: todayRange.startOfDay, $lte: todayRange.endOfDay } }
          ]
        });
        todayTotalExpenses = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        todayExpensesCount = todayExpenses.length;
        todayExpenses.forEach(e => {
          categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
        });

        const yesterdayRange = getDayRange(-1);
        const yesterdayOrders = await Order.find({
          paymentStatus: 'PAID',
          createdAt: { $gte: yesterdayRange.startOfDay, $lte: yesterdayRange.endOfDay }
        });
        yesterdayGrossSales = yesterdayOrders.reduce((sum, o) => sum + (o.finalTotalAmount || 0), 0);
        yesterdayOrdersCount = yesterdayOrders.length;

        const yesterdayExpenses = await Expense.find({ deductedFrom: 'YESTERDAYS_SALES' });
        yesterdayTotalExpenses = yesterdayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
        yesterdayExpensesCount = yesterdayExpenses.length;
      } catch (dbErr) {}
    } else {
      // Calculate from in-memory records
      inMemoryExpenses.forEach(e => {
        todayTotalExpenses += e.amount || 0;
        todayExpensesCount++;
        categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
      });
    }

    res.json({
      success: true,
      today: {
        grossSales: todayGrossSales,
        totalExpenses: todayTotalExpenses,
        netSales: todayGrossSales - todayTotalExpenses,
        ordersCount: todayOrdersCount,
        expensesCount: todayExpensesCount,
        categoryBreakdown
      },
      yesterday: {
        grossSales: yesterdayGrossSales,
        totalExpenses: yesterdayTotalExpenses,
        netSales: yesterdayGrossSales - yesterdayTotalExpenses,
        ordersCount: yesterdayOrdersCount,
        expensesCount: yesterdayExpensesCount
      }
    });
  } catch (error) {
    res.json({
      success: true,
      today: { grossSales: 0, totalExpenses: 0, netSales: 0, ordersCount: 0, expensesCount: 0, categoryBreakdown: {} },
      yesterday: { grossSales: 0, totalExpenses: 0, netSales: 0, ordersCount: 0, expensesCount: 0 }
    });
  }
}

/**
 * Delete / Void an expense entry
 */
async function deleteExpense(req, res) {
  try {
    const { id } = req.params;
    const deleted = await Expense.findByIdAndDelete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Expense entry not found' });
    }

    const { getIO } = require('../sockets/socketHandler');
    const io = getIO();
    if (io) {
      io.emit('expense:deleted', { id });
    }

    res.json({
      success: true,
      message: `Voided expense "${deleted.title}" (₹${deleted.amount})`,
      expense: deleted
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Update an existing expense entry manually
 */
async function updateExpense(req, res) {
  try {
    const { id } = req.params;
    const { title, category, amount, deductedFrom, expenseDate, notes } = req.body;
    const updateData = {};
    if (title) updateData.title = title.trim();
    if (category) updateData.category = category;
    if (amount !== undefined && Number(amount) > 0) updateData.amount = Number(amount);
    if (deductedFrom) updateData.deductedFrom = deductedFrom;
    if (expenseDate) updateData.expenseDate = new Date(expenseDate);
    if (notes !== undefined) updateData.notes = notes.trim();

    const updated = await Expense.findByIdAndUpdate(id, updateData, { new: true });
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Expense entry not found' });
    }

    const { getIO } = require('../sockets/socketHandler');
    const io = getIO();
    if (io) {
      io.emit('expense:updated', { expense: updated });
    }

    res.json({
      success: true,
      message: `Updated expense "${updated.title}" (₹${updated.amount})`,
      expense: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  recordExpense,
  getExpenses,
  getSalesVsExpensesSummary,
  updateExpense,
  deleteExpense
};
