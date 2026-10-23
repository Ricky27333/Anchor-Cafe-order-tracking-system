const Expense = require('../models/Expense');
const Order = require('../models/Order');

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

    const saved = await newExpense.save();
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
    let query = {};

    if (filter === 'today') {
      const { startOfDay, endOfDay } = getDayRange(0);
      query.expenseDate = { $gte: startOfDay, $lte: endOfDay };
    } else if (filter === 'yesterday') {
      const { startOfDay, endOfDay } = getDayRange(-1);
      query.expenseDate = { $gte: startOfDay, $lte: endOfDay };
    }

    const expenses = await Expense.find(query).sort({ expenseDate: -1, createdAt: -1 });

    res.json({
      success: true,
      count: expenses.length,
      expenses
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get Financial Summary: Sales vs Expenses for Today & Yesterday
 */
async function getSalesVsExpensesSummary(req, res) {
  try {
    // 1. Today calculations
    const todayRange = getDayRange(0);
    const todayOrders = await Order.find({
      paymentStatus: 'PAID',
      createdAt: { $gte: todayRange.startOfDay, $lte: todayRange.endOfDay }
    });
    const todayGrossSales = todayOrders.reduce((sum, o) => sum + (o.finalTotalAmount || 0), 0);

    const todayExpenses = await Expense.find({
      $or: [
        { deductedFrom: 'TODAYS_SALES' },
        { expenseDate: { $gte: todayRange.startOfDay, $lte: todayRange.endOfDay } }
      ]
    });
    const todayTotalExpenses = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const todayNetSales = Math.max(0, todayGrossSales - todayTotalExpenses);

    // 2. Yesterday calculations
    const yesterdayRange = getDayRange(-1);
    const yesterdayOrders = await Order.find({
      paymentStatus: 'PAID',
      createdAt: { $gte: yesterdayRange.startOfDay, $lte: yesterdayRange.endOfDay }
    });
    const yesterdayGrossSales = yesterdayOrders.reduce((sum, o) => sum + (o.finalTotalAmount || 0), 0);

    const yesterdayExpenses = await Expense.find({
      deductedFrom: 'YESTERDAYS_SALES'
    });
    const yesterdayTotalExpenses = yesterdayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const yesterdayNetSales = Math.max(0, yesterdayGrossSales - yesterdayTotalExpenses);

    // 3. Category Breakdown for Today's expenses
    const categoryBreakdown = {};
    todayExpenses.forEach(e => {
      categoryBreakdown[e.category] = (categoryBreakdown[e.category] || 0) + e.amount;
    });

    res.json({
      success: true,
      today: {
        grossSales: todayGrossSales,
        totalExpenses: todayTotalExpenses,
        netSales: todayGrossSales - todayTotalExpenses,
        ordersCount: todayOrders.length,
        expensesCount: todayExpenses.length,
        categoryBreakdown
      },
      yesterday: {
        grossSales: yesterdayGrossSales,
        totalExpenses: yesterdayTotalExpenses,
        netSales: yesterdayGrossSales - yesterdayTotalExpenses,
        ordersCount: yesterdayOrders.length,
        expensesCount: yesterdayExpenses.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
