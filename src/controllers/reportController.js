const { generateMonthlyExcelWorkbook } = require('../services/excelReportGenerator');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const DailyReport = require('../models/DailyReport');
const Expense = require('../models/Expense');
const mongoose = require('mongoose');
const localDataStore = require('../services/localDataStore');

/**
 * Generates monthly revenue, raw material expense tracking, and day-by-day decision breakdown
 * @param {number} year - e.g. 2026
 * @param {number} month - 1 to 12 e.g. 10 for October
 */
async function getMonthlyAnalyticsData(year, month) {
  // Correctly compute start and end of month
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
  const daysInMonth = new Date(year, month, 0).getDate();

  let baseReport = {};
  let monthlyExpenses = [];

  const isDbConnected = mongoose.connection && mongoose.connection.readyState === 1;

  if (isDbConnected) {
    try {
      const monthlyReport = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        orderStatus: { $ne: 'CANCELLED' }
      }
    },
    {
      $facet: {
        // Overall Financial Totals
        summaryTotals: [
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$finalTotalAmount' },
              totalOrders: { $sum: 1 },
              averageOrderValue: { $avg: '$finalTotalAmount' },
              totalItemsSold: { $sum: '$totalItemCount' }
            }
          }
        ],
        // Day-by-Day Sales Trends
        dailyTrends: [
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
              dailyRevenue: { $sum: '$finalTotalAmount' },
              dailyOrders: { $sum: 1 }
            }
          },
          { $sort: { _id: 1 } }
        ],
        // Payment Method Breakdown
        paymentBreakdown: [
          {
            $group: {
              _id: '$paymentMethod',
              methodRevenue: { $sum: '$finalTotalAmount' },
              transactionCount: { $sum: 1 }
            }
          }
        ],
        // Top 10 Bestselling Items
        topBestsellers: [
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.title',
              quantitySold: { $sum: '$items.quantity' },
              itemRevenue: { $sum: '$items.subtotal' }
            }
          },
          { $sort: { quantitySold: -1 } },
          { $limit: 10 }
        ],
        // Category breakdown
        categoryBreakdown: [
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.category',
              revenue: { $sum: '$items.subtotal' },
              count: { $sum: '$items.quantity' }
            }
          }
        ],
        // Table-Wise Breakdown (Which table gets the orders)
        tableBreakdown: [
          {
            $group: {
              _id: '$locationDetails.tableNumber',
              revenue: { $sum: '$finalTotalAmount' },
              orderCount: { $sum: 1 },
              totalItems: { $sum: '$totalItemCount' }
            }
          },
          { $sort: { revenue: -1 } }
        ]
      }
    }
  ]);

      baseReport = monthlyReport[0] || {};
      monthlyExpenses = await Expense.find({
        expenseDate: { $gte: startDate, $lte: endDate }
      }).sort({ expenseDate: -1, createdAt: -1 });
    } catch (dbErr) {
      console.warn('MongoDB aggregate query failed, using local store fallback:', dbErr.message);
    }
  }

  // High-availability fallback from localDataStore
  if (!baseReport.summaryTotals || baseReport.summaryTotals.length === 0) {
    const allStoreOrders = localDataStore.getOrders() || [];
    const monthOrders = allStoreOrders.filter(o => {
      const d = new Date(o.createdAt);
      return d >= startDate && d <= endDate && o.orderStatus !== 'CANCELLED';
    });
    
    let totalRev = 0;
    let totalItems = 0;
    const dailyMap = {};
    const pBreakdown = {};
    const catMap = {};
    const bestsellersMap = {};

    monthOrders.forEach(o => {
      const rev = o.finalTotalAmount || 0;
      totalRev += rev;
      totalItems += (o.totalItemCount || 0);

      const dStr = new Date(o.createdAt).toISOString().split('T')[0];
      if (!dailyMap[dStr]) dailyMap[dStr] = { _id: dStr, dailyRevenue: 0, dailyOrders: 0 };
      dailyMap[dStr].dailyRevenue += rev;
      dailyMap[dStr].dailyOrders += 1;

      const pm = o.paymentMethod || 'OTHER';
      if (!pBreakdown[pm]) pBreakdown[pm] = { _id: pm, methodRevenue: 0, transactionCount: 0 };
      pBreakdown[pm].methodRevenue += rev;
      pBreakdown[pm].transactionCount += 1;

      (o.items || []).forEach(it => {
        const cat = it.category || 'other';
        if (!catMap[cat]) catMap[cat] = { _id: cat, revenue: 0, count: 0 };
        catMap[cat].revenue += (it.subtotal || 0);
        catMap[cat].count += (it.quantity || 1);

        const title = it.title || 'Item';
        if (!bestsellersMap[title]) bestsellersMap[title] = { _id: title, quantitySold: 0, itemRevenue: 0 };
        bestsellersMap[title].quantitySold += (it.quantity || 1);
        bestsellersMap[title].itemRevenue += (it.subtotal || 0);
      });
    });

    baseReport = {
      summaryTotals: [{
        _id: null,
        totalRevenue: totalRev,
        totalOrders: monthOrders.length,
        averageOrderValue: monthOrders.length > 0 ? Math.round(totalRev / monthOrders.length) : 0,
        totalItemsSold: totalItems
      }],
      dailyTrends: Object.values(dailyMap).sort((a,b) => a._id.localeCompare(b._id)),
      paymentBreakdown: Object.values(pBreakdown),
      topBestsellers: Object.values(bestsellersMap).sort((a,b) => b.quantitySold - a.quantitySold).slice(0, 10),
      categoryBreakdown: Object.values(catMap),
      tableBreakdown: []
    };
  }

  if (!monthlyExpenses || monthlyExpenses.length === 0) {
    const allStoreExpenses = localDataStore.getExpenses() || [];
    monthlyExpenses = allStoreExpenses.filter(e => {
      const d = new Date(e.expenseDate);
      return d >= startDate && d <= endDate;
    });
  }

  const dailyExpensesMap = {};
  let totalMonthlyExpenses = 0;
  const expenseCategories = {};

  monthlyExpenses.forEach(exp => {
    totalMonthlyExpenses += exp.amount;
    const dStr = new Date(exp.expenseDate).toISOString().split('T')[0];
    if (!dailyExpensesMap[dStr]) {
      dailyExpensesMap[dStr] = { total: 0, count: 0, items: [] };
    }
    dailyExpensesMap[dStr].total += exp.amount;
    dailyExpensesMap[dStr].count += 1;
    dailyExpensesMap[dStr].items.push(exp);

    expenseCategories[exp.category] = (expenseCategories[exp.category] || 0) + exp.amount;
  });

  // 3. Map day-by-day sales vs raw material expenses (Daily Tracking)
  const dailyOrdersMap = {};
  (baseReport.dailyTrends || []).forEach(dt => {
    dailyOrdersMap[dt._id] = dt;
  });

  const totalGrossSales = baseReport.summaryTotals?.[0]?.totalRevenue || 0;
  const netOperatingProfit = totalGrossSales - totalMonthlyExpenses;

  const dailyLedger = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dayStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const dDate = new Date(Date.UTC(year, month - 1, day));
    const dayName = dDate.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

    const daySales = dailyOrdersMap[dayStr]?.dailyRevenue || 0;
    const dayOrders = dailyOrdersMap[dayStr]?.dailyOrders || 0;
    const dayExpense = dailyExpensesMap[dayStr]?.total || 0;
    const dayExpenseCount = dailyExpensesMap[dayStr]?.count || 0;
    const dayNet = daySales - dayExpense;

    let status = 'IDLE';
    let decision = 'No Activity';
    if (daySales > 0 && dayNet > 0) {
      status = 'PROFIT';
      decision = `Profit: +₹${dayNet} (${Math.round((dayNet / daySales) * 100)}% margin)`;
    } else if (daySales > 0 && dayNet <= 0) {
      status = 'DEFICIT';
      decision = `Loss / High Burn: -₹${Math.abs(dayNet)}`;
    } else if (daySales === 0 && dayExpense > 0) {
      status = 'PROCUREMENT_ONLY';
      decision = `Procurement Spend: ₹${dayExpense}`;
    }

    dailyLedger.push({
      day,
      date: dayStr,
      dayName,
      grossSales: daySales,
      rawMaterialExpenses: dayExpense,
      netProfit: dayNet,
      marginPct: daySales > 0 ? Math.round((dayNet / daySales) * 100) : (dayExpense > 0 ? -100 : 0),
      ordersCount: dayOrders,
      expensesCount: dayExpenseCount,
      status,
      decision
    });
  }

  // 4. Monthly Decision Insight
  const monthlyMarginPct = totalGrossSales > 0 ? Math.round((netOperatingProfit / totalGrossSales) * 100) : 0;
  const monthlyFinancials = {
    totalGrossSales,
    totalExpenses: totalMonthlyExpenses,
    netOperatingProfit,
    monthlyMarginPct,
    daysInMonth,
    avgDailySales: Math.round(totalGrossSales / daysInMonth),
    avgDailyExpense: Math.round(totalMonthlyExpenses / daysInMonth),
    verdict: netOperatingProfit > 0 ? 'HEALTHY_PROFIT' : (totalGrossSales === 0 && totalMonthlyExpenses > 0 ? 'INVESTMENT_PHASE' : 'BREAK_EVEN'),
    decisionText: `For ${new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })}, gross sales stand at ₹${totalGrossSales.toLocaleString()} against ₹${totalMonthlyExpenses.toLocaleString()} spent on raw materials & cafe supplies. Net operating cash flow is ${netOperatingProfit >= 0 ? '+' : ''}₹${netOperatingProfit.toLocaleString()} (${monthlyMarginPct}% margin). Daily raw material burn rate averages ₹${Math.round(totalMonthlyExpenses / daysInMonth).toLocaleString()}/day.`
  };

  return {
    ...baseReport,
    monthlyFinancials,
    dailyLedger,
    rawMaterialExpenses: monthlyExpenses,
    expenseCategories
  };
}

/**
 * Controller: GET /api/reports/monthly?year=2026&month=10
 */
async function getMonthlyReport(req, res) {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);

    const data = await getMonthlyAnalyticsData(year, month);
    res.json({
      success: true,
      year,
      month,
      analytics: data
    });
  } catch (error) {
    console.error('Error fetching monthly report:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Controller: GET /api/reports/daily/summary
 * Real-time summary for today
 */
async function getDailySummary(req, res) {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const orders = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    let totalRevenue = 0;
    let completedOrders = 0;
    let activeOrders = 0;
    let cancelledOrders = 0;
    let cashRevenue = 0;
    let upiRevenue = 0;
    let cardRevenue = 0;

    const categoryRevenue = {
      'hot-beverages': 0,
      'mojitos': 0,
      'shakes': 0,
      'icecream': 0,
      'snacks': 0,
      'beach-services': 0
    };

    const itemCounts = {};

    orders.forEach(order => {
      if (order.orderStatus === 'CANCELLED') {
        cancelledOrders++;
        return;
      }

      totalRevenue += order.finalTotalAmount;

      if (order.orderStatus === 'SERVED') {
        completedOrders++;
      } else {
        activeOrders++;
      }

      if (order.paymentMethod === 'CASH') {
        cashRevenue += order.finalTotalAmount;
      } else if (order.paymentMethod === 'CARD') {
        cardRevenue += order.finalTotalAmount;
      } else {
        upiRevenue += order.finalTotalAmount;
      }

      order.items.forEach(it => {
        if (categoryRevenue[it.category] !== undefined) {
          categoryRevenue[it.category] += it.subtotal;
        } else {
          categoryRevenue[it.category] = it.subtotal;
        }

        if (!itemCounts[it.title]) {
          itemCounts[it.title] = { title: it.title, quantity: 0, revenue: 0 };
        }
        itemCounts[it.title].quantity += it.quantity;
        itemCounts[it.title].revenue += it.subtotal;
      });
    });

    const topSoldItems = Object.values(itemCounts)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Fetch today's raw material expenses
    const todayExpenses = await Expense.find({
      $or: [
        { deductedFrom: 'TODAYS_SALES' },
        { expenseDate: { $gte: startOfDay, $lte: endOfDay } }
      ]
    });
    const totalTodayExpenses = todayExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const netTodayRevenue = totalRevenue - totalTodayExpenses;

    const dateStr = startOfDay.toISOString().split('T')[0];

    // Check if day was closed
    const closedRecord = await DailyReport.findOne({ reportDate: dateStr });

    res.json({
      success: true,
      reportDate: dateStr,
      isClosed: !!closedRecord?.isClosed,
      totals: {
        totalRevenue,
        totalExpenses: totalTodayExpenses,
        netRevenue: netTodayRevenue,
        totalOrders: orders.length,
        completedOrders,
        activeOrders,
        cancelledOrders,
        cashRevenue,
        upiRevenue,
        cardRevenue,
        upiRatio: totalRevenue > 0 ? Math.round((upiRevenue / totalRevenue) * 100) : 0,
        expensesCount: todayExpenses.length
      },
      categoryRevenue,
      topSoldItems
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Controller: POST /api/reports/daily/close-day
 * Generates official Day-End Z-Report
 */
async function closeDayReport(req, res) {
  try {
    const { closingCashInDrawer = 0, notes = '' } = req.body;
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0];

    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 0, 0, 0);
    const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59);

    const orders = await Order.find({
      createdAt: { $gte: startOfDay, $lte: endOfDay }
    });

    let totalGrossSales = 0;
    let totalDiscountGiven = 0;
    let completedOrdersCount = 0;
    let cancelledOrdersCount = 0;
    let cashRevenue = 0;
    let upiRevenue = 0;
    let cardRevenue = 0;

    const salesByCategory = {
      hotBeverages: 0,
      mojitos: 0,
      shakes: 0,
      icecream: 0,
      snacks: 0,
      beachEvents: 0
    };

    const itemStats = {};

    orders.forEach(o => {
      if (o.orderStatus === 'CANCELLED') {
        cancelledOrdersCount++;
        return;
      }

      totalGrossSales += o.subtotalAmount;
      totalDiscountGiven += (o.discountAmount || 0);

      if (o.orderStatus === 'SERVED') completedOrdersCount++;

      if (o.paymentMethod === 'CASH') cashRevenue += o.finalTotalAmount;
      else if (o.paymentMethod === 'CARD') cardRevenue += o.finalTotalAmount;
      else upiRevenue += o.finalTotalAmount;

      o.items.forEach(it => {
        if (it.category === 'hot-beverages') salesByCategory.hotBeverages += it.subtotal;
        else if (it.category === 'mojitos') salesByCategory.mojitos += it.subtotal;
        else if (it.category === 'shakes') salesByCategory.shakes += it.subtotal;
        else if (it.category === 'icecream') salesByCategory.icecream += it.subtotal;
        else if (it.category === 'snacks') salesByCategory.snacks += it.subtotal;
        else if (it.category === 'beach-services') salesByCategory.beachEvents += it.subtotal;

        if (!itemStats[it.title]) itemStats[it.title] = { title: it.title, quantity: 0, revenue: 0 };
        itemStats[it.title].quantity += it.quantity;
        itemStats[it.title].revenue += it.subtotal;
      });
    });

    const topSoldItems = Object.values(itemStats)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    const totalNetSales = Math.max(0, totalGrossSales - totalDiscountGiven);
    const cashDiscrepancy = Number(closingCashInDrawer) - cashRevenue;

    const report = await DailyReport.findOneAndUpdate(
      { reportDate: dateStr },
      {
        reportDate: dateStr,
        totalGrossSales,
        totalNetSales,
        totalDiscountGiven,
        totalOrderCount: orders.length,
        completedOrdersCount,
        cancelledOrdersCount,
        cashRevenue,
        upiRevenue,
        cardRevenue,
        salesByCategory,
        topSoldItems,
        closingCashInDrawer: Number(closingCashInDrawer),
        cashDiscrepancy,
        notes,
        isClosed: true
      },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `Day-End Z-Report closed successfully for ${dateStr}!`,
      report
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Controller: POST /api/reports/reset-records
 * Clears all test orders, payments, expenses, and daily reports (Clean database reset)
 */
async function resetRecords(req, res) {
  try {
    const ordersDeleted = await Order.deleteMany({});
    const paymentsDeleted = await Payment.deleteMany({});
    const expensesDeleted = await Expense.deleteMany({});
    const reportsDeleted = await DailyReport.deleteMany({});

    // Also clear in Oracle DB if connected
    try {
      const { executeQuery } = require('../config/oracleDatabase');
      await executeQuery('DELETE FROM ANCHOR_TRACK.ORDER_ITEMS');
      await executeQuery('DELETE FROM ANCHOR_TRACK.PAYMENTS');
      await executeQuery('DELETE FROM ANCHOR_TRACK.ORDERS');
      await executeQuery('DELETE FROM ANCHOR_TRACK.EXPENSES');
      await executeQuery('COMMIT');
    } catch (e) {}

    const { getIO } = require('../sockets/socketHandler');
    const io = getIO();
    if (io) {
      io.emit('database:cleared', {});
    }

    res.json({
      success: true,
      message: 'All test orders, payments, expenses, and day-end reports have been cleared. Database is reset clean.',
      cleared: {
        orders: ordersDeleted.deletedCount,
        payments: paymentsDeleted.deletedCount,
        expenses: expensesDeleted.deletedCount,
        reports: reportsDeleted.deletedCount
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}


/**
 * Controller: GET /api/reports/export/daily-ledger-csv?year=2026&month=11
 * Generates an executive, RFC 4180 compliant single-table CSV document where
 * EVERY row strictly shares the exact same 10 columns for 1:1 Excel/Google Sheets alignment:
 * Date (DD-MMM-YYYY), Day of Week, Gross Sales, Raw Material Spend, Net Daily Profit,
 * Margin %, Orders Count, Material Buys, Operating Status, and Managerial Notes.
 */
async function exportDailyLedgerCsv(req, res) {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);

    const data = await getMonthlyAnalyticsData(year, month);
    const fin = data.monthlyFinancials || {};
    const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    function esc(val) {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }

    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthShortStr = monthsShort[month - 1];

    const lines = [];

    // Document Headers - padded to 10 columns
    lines.push([esc('ANCHOR CAFE - COASTAL ORDER TRACKING & FINANCIAL SYSTEM'), esc(''), esc(''), esc(''), esc(''), esc(''), esc(''), esc(''), esc(''), esc('')].join(','));
    lines.push([esc('RAMAPURAM BEACH, CHIRALA (CHORAMANDAL COAST) | OWNER: anchorcafe01@gmail.com'), esc(''), esc(''), esc(''), esc(''), esc(''), esc(''), esc(''), esc(''), esc('')].join(','));
    lines.push([esc(`MONTHLY DAILY FINANCIAL & OPERATING LEDGER: ${monthName.toUpperCase()}`), esc(''), esc(''), esc(''), esc(''), esc(''), esc(''), esc(''), esc(''), esc('')].join(','));
    lines.push([esc(`Generated On: ${new Date().toLocaleString('en-IN')} | Database: MongoDB Core + Oracle XE 21c (ANCHOR_TRACK)`), esc(''), esc(''), esc(''), esc(''), esc(''), esc(''), esc(''), esc(''), esc('')].join(','));
    lines.push('');

    // Uniform 10-Column Table Header
    const headers = [
      'Date',
      'Day of Week',
      'Gross Sales (INR)',
      'Raw Material Spend (INR)',
      'Net Daily Profit (INR)',
      'Profit Margin (%)',
      'Orders Settled',
      'Material Purchases',
      'Operating Status',
      'Managerial Decision & Notes'
    ];
    lines.push(headers.map(esc).join(','));

    let totalGross = 0;
    let totalExpense = 0;
    let totalNet = 0;
    let totalOrders = 0;
    let totalBuys = 0;

    (data.dailyLedger || []).forEach(d => {
      const dayPad = String(d.day).padStart(2, '0');
      const safeDate = `${dayPad}-${monthShortStr}-${year}`;
      const sales = Number(d.grossSales || 0);
      const expense = Number(d.rawMaterialExpenses || 0);
      const net = Number(d.netProfit || 0);
      const orders = Number(d.ordersCount || 0);
      const buys = Number(d.expensesCount || 0);

      totalGross += sales;
      totalExpense += expense;
      totalNet += net;
      totalOrders += orders;
      totalBuys += buys;

      lines.push([
        esc(safeDate),
        esc(d.dayName || ''),
        esc(sales.toFixed(2)),
        esc(expense.toFixed(2)),
        esc(net.toFixed(2)),
        esc(`${d.marginPct || 0}%`),
        esc(orders),
        esc(buys),
        esc(d.status || 'IDLE'),
        esc(d.decision || 'No Activity')
      ].join(','));
    });

    lines.push('');

    // Uniform 10-Column Month Totals & Executive Verdict
    const overallMargin = totalGross > 0 ? Math.round((totalNet / totalGross) * 100) : (totalExpense > 0 ? -100 : 0);
    const overallVerdict = fin.verdict || (totalNet > 0 ? 'PROFITABLE' : (totalNet === 0 ? 'BREAK_EVEN' : 'DEFICIT'));

    lines.push([
      esc(`TOTALS / MONTH SUMMARY (${monthName})`),
      esc(`${data.dailyLedger?.length || 0} Days Audited`),
      esc(totalGross.toFixed(2)),
      esc(totalExpense.toFixed(2)),
      esc(totalNet.toFixed(2)),
      esc(`${overallMargin}%`),
      esc(totalOrders),
      esc(totalBuys),
      esc(overallVerdict),
      esc(fin.recommendation || fin.reason || 'Complete monthly accounting reconciled')
    ].join(','));

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const safeMonthStr = String(month).padStart(2, '0');
    const filename = `Anchor_Cafe_Daily_Ledger_${year}_${safeMonthStr}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error exporting daily ledger CSV:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Controller: GET /api/reports/export/monthly-csv?year=2026&month=11
 * Generates an executive, RFC 4180 compliant CSV document with UTF-8 BOM
 * that opens directly in Google Sheets / Microsoft Excel with all monthly
 * revenue, day-by-day calculations, payment splits, and raw material procurement history.
 */
async function exportMonthlyCsv(req, res) {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);

    const data = await getMonthlyAnalyticsData(year, month);
    const fin = data.monthlyFinancials || {};
    const monthName = new Date(Date.UTC(year, month - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

    function esc(val) {
      if (val === null || val === undefined) return '""';
      const str = String(val);
      return `"${str.replace(/"/g, '""')}"`;
    }

    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthShortStr = monthsShort[month - 1];

    const lines = [];

    // Helper to pad row to 11 columns
    function pad11(arr) {
      while (arr.length < 11) arr.push(esc(''));
      return arr.join(',');
    }

    // Title Block
    lines.push(pad11([esc('ANCHOR CAFE - COASTAL ORDER TRACKING & FINANCIAL SYSTEM')]));
    lines.push(pad11([esc('RAMAPURAM BEACH, CHIRALA (CHORAMANDAL COAST) | OWNER: anchorcafe01@gmail.com')]));
    lines.push(pad11([esc(`MONTHLY EXECUTIVE REVENUE & PROCUREMENT REPORT: ${monthName.toUpperCase()}`)]));
    lines.push(pad11([esc(`Generated On: ${new Date().toLocaleString('en-IN')} | MongoDB + Oracle XE 21c`)]));
    lines.push('');

    // Section 1: Executive Summary P&L
    lines.push(pad11([esc('=============================='), esc('==============================')]));
    lines.push(pad11([esc('1. MONTHLY EXECUTIVE P&L FINANCIAL SUMMARY')]));
    lines.push(pad11([esc('=============================='), esc('==============================')]));
    lines.push(pad11([esc('Financial Metric'), esc('Amount (INR) / Value'), esc('Notes / Breakdown')]));
    lines.push(pad11([esc('Total Gross Customer Sales'), esc((fin.totalGrossSales || 0).toFixed(2)), esc('Total billings across all completed orders')]));
    lines.push(pad11([esc('Total Raw Material Spend'), esc((fin.totalExpenses || 0).toFixed(2)), esc('Procurement for Milk, Coffee, Ice, Packaging & Produce')]));
    lines.push(pad11([esc('Net Operating Cash Profit'), esc((fin.netOperatingProfit || 0).toFixed(2)), esc('Gross Sales minus Raw Material Expenditures')]));
    lines.push(pad11([esc('Operating Profit Margin (%)'), esc(`${fin.monthlyMarginPct || 0}%`), esc(fin.verdict || 'BREAK_EVEN')]));
    lines.push(pad11([esc('Total Customer Orders Placed'), esc(data.summaryTotals?.[0]?.totalOrders || 0), esc('Completed and settled order count')]));
    lines.push(pad11([esc('Total Cafe Offerings Sold'), esc(data.summaryTotals?.[0]?.totalItemsSold || 0), esc('Cumulative units prepared and served')]));
    lines.push(pad11([esc('Average Order Value (AOV)'), esc(Math.round(data.summaryTotals?.[0]?.averageOrderValue || 0)), esc('Average spend per customer table')]));
    lines.push(pad11([esc('Daily Raw Material Burn Rate'), esc(fin.avgDailyExpense || 0), esc('Average procurement spend per day')]));
    lines.push('');

    // Section 2: Payment Settlement Breakdown
    lines.push(pad11([esc('=============================='), esc('=============================='), esc('==============================')]));
    lines.push(pad11([esc('2. PAYMENT METHOD RECONCILIATION (UPI vs CASH)')]));
    lines.push(pad11([esc('=============================='), esc('=============================='), esc('==============================')]));
    lines.push(pad11([esc('Payment Mode'), esc('Total Settled (INR)'), esc('Transactions Count'), esc('% of Total Revenue')]));
    const totalRev = fin.totalGrossSales || 1;
    (data.paymentBreakdown || []).forEach(p => {
      const pct = Math.round(((p.methodRevenue || 0) / totalRev) * 100);
      lines.push(pad11([esc(p._id || 'OTHER'), esc((p.methodRevenue || 0).toFixed(2)), esc(p.transactionCount || 0), esc(`${pct}%`)]));
    });
    lines.push('');

    // Section 3: Day-by-Day Financial Tracking Ledger
    lines.push(pad11([esc('=============================='), esc('=============================='), esc('=============================='), esc('==============================')]));
    lines.push(pad11([esc('3. DAY-BY-DAY FINANCIAL & OPERATING LEDGER')]));
    lines.push(pad11([esc('=============================='), esc('=============================='), esc('=============================='), esc('==============================')]));
    lines.push(pad11([
      esc('Day'),
      esc('Date'),
      esc('Weekday'),
      esc('Gross Sales (INR)'),
      esc('Raw Material Spend (INR)'),
      esc('Net Daily Profit (INR)'),
      esc('Margin (%)'),
      esc('Orders Count'),
      esc('Material Buys Count'),
      esc('Day Operating Status'),
      esc('Managerial Decision & Notes')
    ]));

    (data.dailyLedger || []).forEach(d => {
      const dayPad = String(d.day).padStart(2, '0');
      const safeFormattedDate = `${dayPad}-${monthShortStr}-${year}`;
      lines.push(pad11([
        esc(d.day),
        esc(safeFormattedDate),
        esc(d.dayName),
        esc((d.grossSales || 0).toFixed(2)),
        esc((d.rawMaterialExpenses || 0).toFixed(2)),
        esc((d.netProfit || 0).toFixed(2)),
        esc(`${d.marginPct || 0}%`),
        esc(d.ordersCount || 0),
        esc(d.expensesCount || 0),
        esc(d.status || 'IDLE'),
        esc(d.decision || 'No Activity')
      ]));
    });
    lines.push('');

    // Section 4: Itemized Raw Material Procurement History
    lines.push(pad11([esc('=============================='), esc('=============================='), esc('=============================='), esc('==============================')]));
    lines.push(pad11([esc('4. ITEMIZED RAW MATERIAL PROCUREMENT & EXPENSE LEDGER')]));
    lines.push(pad11([esc('=============================='), esc('=============================='), esc('=============================='), esc('==============================')]));
    lines.push(pad11([
      esc('Purchase Date'),
      esc('Raw Material / Item Description'),
      esc('Category'),
      esc('Cost Amount (INR)'),
      esc('Payment Source / Deducted From'),
      esc('Supplier / Purchase Notes'),
      esc('Recorded By')
    ]));

    (data.rawMaterialExpenses || []).forEach(e => {
      const dStr = new Date(e.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      lines.push(pad11([
        esc(dStr),
        esc(e.title || 'Untitled Material'),
        esc(e.category || 'MISC_EXPENSE'),
        esc((e.amount || 0).toFixed(2)),
        esc(e.deductedFrom || 'TODAYS_SALES'),
        esc(e.notes || '—'),
        esc(e.recordedBy || 'Counter 1')
      ]));
    });
    lines.push('');

    // Section 5: Category-Wise Sales Velocity
    lines.push(pad11([esc('=============================='), esc('=============================='), esc('==============================')]));
    lines.push(pad11([esc('5. CATEGORY-WISE SALES VELOCITY')]));
    lines.push(pad11([esc('=============================='), esc('=============================='), esc('==============================')]));
    lines.push(pad11([esc('Menu Category'), esc('Units Sold'), esc('Total Revenue (INR)')]));
    (data.categoryBreakdown || []).forEach(c => {
      lines.push(pad11([esc(c._id || 'Other'), esc(c.count || 0), esc((c.revenue || 0).toFixed(2))]));
    });
    lines.push('');

    // Section 6: Top 10 Bestsellers
    lines.push(pad11([esc('=============================='), esc('=============================='), esc('==============================')]));
    lines.push(pad11([esc('6. TOP 10 BESTSELLING COASTAL OFFERINGS')]));
    lines.push(pad11([esc('=============================='), esc('=============================='), esc('==============================')]));
    lines.push(pad11([esc('Item Title'), esc('Units Sold'), esc('Revenue Generated (INR)')]));
    (data.topBestsellers || []).forEach(b => {
      lines.push(pad11([esc(b._id || 'Unknown'), esc(b.quantitySold || 0), esc((b.itemRevenue || 0).toFixed(2))]));
    });

    const csvContent = '\uFEFF' + lines.join('\r\n');
    const safeMonthStr = String(month).padStart(2, '0');
    const filename = `Anchor_Cafe_Monthly_Master_${year}_${safeMonthStr}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('Error exporting monthly CSV sheet:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}


/**
 * Controller: GET /api/reports/export/monthly-xlsx?year=2026&month=11
 * Generates an executive multi-tab Excel/Google Sheets workbook (.xlsx)
 * with auto-fitted column widths, styled header rows, and pre-calculated totals
 */
async function exportMonthlyXlsx(req, res) {
  try {
    const now = new Date();
    const year = parseInt(req.query.year, 10) || now.getFullYear();
    const month = parseInt(req.query.month, 10) || (now.getMonth() + 1);

    const data = await getMonthlyAnalyticsData(year, month);
    const buffer = await generateMonthlyExcelWorkbook(data, year, month);

    const safeMonthStr = String(month).padStart(2, '0');
    const filename = `Anchor_Cafe_Monthly_Workbook_${year}_${safeMonthStr}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    console.error('Error exporting monthly XLSX workbook:', err);
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = {
  getMonthlyReport,
  exportDailyLedgerCsv,
  exportMonthlyCsv,
  exportMonthlyXlsx,
  getDailySummary,
  closeDayReport,
  getMonthlyAnalyticsData,
  resetRecords
};
