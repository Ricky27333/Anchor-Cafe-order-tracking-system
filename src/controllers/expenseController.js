const Expense = require('../models/Expense');
const Order = require('../models/Order');
const mongoose = require('mongoose');
const localDataStore = require('../services/localDataStore');

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

    localDataStore.saveExpense(saved.toObject ? saved.toObject() : saved);

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
 * Get list of recorded expenses (filterable by date=today, yesterday, all, year, month, category, search)
 */
async function getExpenses(req, res) {
  try {
    const { filter = 'all', month, year, category, search } = req.query;
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
        } else if (year && month) {
          const y = parseInt(year, 10);
          const m = parseInt(month, 10);
          const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0));
          const end = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
          query.expenseDate = { $gte: start, $lte: end };
        }

        if (category && category !== 'all') {
          query.category = category;
        }

        if (search && search.trim()) {
          const s = search.trim();
          query.$or = [
            { title: { $regex: s, $options: 'i' } },
            { notes: { $regex: s, $options: 'i' } }
          ];
        }

        expenses = await Expense.find(query).sort({ expenseDate: -1, createdAt: -1 });
      } catch (e) {
        expenses = localDataStore.getExpenses() || [];
      }
    } else {
      expenses = localDataStore.getExpenses() || [];
    }

    if (!Array.isArray(expenses) || expenses.length === 0) {
      const fallback = localDataStore.getExpenses() || [];
      if (fallback.length > 0) expenses = fallback;
    }

    res.json({
      success: true,
      count: expenses.length,
      expenses
    });
  } catch (error) {
    const fallback = localDataStore.getExpenses() || [];
    res.json({
      success: true,
      count: fallback.length,
      expenses: fallback
    });
  }
}

/**
 * Complete Raw Material Spending Intelligence across Months
 * Tracks:
 * 1. Which month spent how much money on what raw materials
 * 2. Grouped spend by raw material item name (e.g. Milk 5L, Ice, Coffee beans)
 * 3. Complete historical purchase ledger with search & category breakdowns
 * 4. Month-over-month expenditure trends (past 12 months)
 */
async function getRawMaterialIntelligence(req, res) {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);

    let allExpenses = [];
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        allExpenses = await Expense.find({}).sort({ expenseDate: -1, createdAt: -1 });
      } catch (e) {
        allExpenses = localDataStore.getExpenses() || [];
      }
    } else {
      allExpenses = localDataStore.getExpenses() || [];
    }

    if (!allExpenses || allExpenses.length === 0) {
      allExpenses = localDataStore.getExpenses() || [];
    }

    const selectedMonthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const selectedMonthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

    const selectedMonthExpenses = allExpenses.filter(e => {
      const d = new Date(e.expenseDate);
      return d >= selectedMonthStart && d <= selectedMonthEnd;
    });

    const totalSelectedMonthSpend = selectedMonthExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    const categoryBreakdown = {};
    selectedMonthExpenses.forEach(e => {
      const cat = e.category || 'MISC_EXPENSE';
      categoryBreakdown[cat] = (categoryBreakdown[cat] || 0) + (e.amount || 0);
    });

    const materialMap = {};
    selectedMonthExpenses.forEach(e => {
      const cleanTitle = (e.title || 'Untitled Material').trim();
      const normKey = cleanTitle.toLowerCase();
      if (!materialMap[normKey]) {
        materialMap[normKey] = {
          title: cleanTitle,
          category: e.category,
          totalAmount: 0,
          purchaseCount: 0,
          latestDate: e.expenseDate,
          supplierNotes: e.notes || '',
          deductedFrom: e.deductedFrom
        };
      }
      materialMap[normKey].totalAmount += (e.amount || 0);
      materialMap[normKey].purchaseCount += 1;
      if (new Date(e.expenseDate) > new Date(materialMap[normKey].latestDate)) {
        materialMap[normKey].latestDate = e.expenseDate;
      }
    });

    const materialBreakdown = Object.values(materialMap).sort((a, b) => b.totalAmount - a.totalAmount);

    const monthlyTrendMap = {};
    for (let i = 0; i < 12; i++) {
      const d = new Date(Date.UTC(year, month - 1 - i, 1));
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const key = y + '-' + String(m).padStart(2, '0');
      const label = d.toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
      monthlyTrendMap[key] = {
        year: y,
        month: m,
        key,
        label,
        totalSpend: 0,
        purchaseCount: 0,
        categories: {}
      };
    }

    allExpenses.forEach(e => {
      const d = new Date(e.expenseDate);
      const y = d.getUTCFullYear();
      const m = d.getUTCMonth() + 1;
      const key = y + '-' + String(m).padStart(2, '0');
      if (monthlyTrendMap[key]) {
        monthlyTrendMap[key].totalSpend += (e.amount || 0);
        monthlyTrendMap[key].purchaseCount += 1;
        const cat = e.category || 'MISC_EXPENSE';
        monthlyTrendMap[key].categories[cat] = (monthlyTrendMap[key].categories[cat] || 0) + (e.amount || 0);
      }
    });

    const monthlyTrends = Object.values(monthlyTrendMap).reverse();

    const allPurchases = allExpenses.map(e => ({
      _id: e._id,
      title: e.title,
      category: e.category,
      amount: e.amount,
      deductedFrom: e.deductedFrom,
      expenseDate: e.expenseDate,
      notes: e.notes || '',
      recordedBy: e.recordedBy || 'Counter 1'
    }));

    res.json({
      success: true,
      selectedYear: year,
      selectedMonth: month,
      summary: {
        totalSelectedMonthSpend,
        purchaseCount: selectedMonthExpenses.length,
        categoryBreakdown,
        materialBreakdown
      },
      monthlyTrends,
      allPurchasesCount: allPurchases.length,
      allPurchases
    });
  } catch (error) {
    console.error('Error getting raw material intelligence:', error);
    res.status(500).json({ success: false, message: error.message });
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
    localDataStore.deleteExpense(id);
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
    localDataStore.updateExpense(id, updateData);
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
  getRawMaterialIntelligence,
  getSalesVsExpensesSummary,
  updateExpense,
  deleteExpense
};
