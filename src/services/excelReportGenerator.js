const ExcelJS = require('exceljs');

/**
 * Generates an executive, multi-tab Microsoft Excel / Google Sheets workbook (.xlsx)
 * with auto-fitted column widths, corporate navy/gold styling, currency formatting,
 * and pre-calculated accounting formulas.
 * 
 * @param {Object} data - Monthly analytics report object from getMonthlyAnalyticsData
 * @param {number} year - e.g. 2026
 * @param {number} month - e.g. 10 or 11
 * @returns {Promise<Buffer>} - Buffer of the .xlsx file
 */
async function generateMonthlyExcelWorkbook(data, year, month) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Anchor Cafe Order Tracking System';
  workbook.lastModifiedBy = 'anchorcafe01@gmail.com';
  workbook.created = new Date();
  workbook.modified = new Date();

  const fin = data.monthlyFinancials || {};
  const monthDate = new Date(Date.UTC(year, month - 1, 1));
  const monthName = monthDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });

  // Styles
  const navyHeaderFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0A1626' } // Deep Coastal Navy
  };
  const goldHeaderFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFC9A86A' } // Coastal Gold
  };
  const subHeaderFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF162E4A' } // Slate Navy
  };
  const totalsRowFill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FFF4EAD4' } // Light Gold
  };

  const whiteBoldFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  const darkBoldFont = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FF0A1626' } };
  const titleFont = { name: 'Segoe UI', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  const regularFont = { name: 'Segoe UI', size: 10, color: { argb: 'FF1F2937' } };

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  };

  const doubleBottomBorder = {
    top: { style: 'thin', color: { argb: 'FF0A1626' } },
    bottom: { style: 'double', color: { argb: 'FF0A1626' } }
  };

  // =========================================================================
  // TAB 1: 📊 Executive P&L Dashboard
  // =========================================================================
  const sheet1 = workbook.addWorksheet('📊 Executive P&L Summary', {
    views: [{ showGridLines: true }]
  });

  // Banner Rows
  sheet1.mergeCells('A1:D1');
  sheet1.getCell('A1').value = '⚓ ANCHOR CAFE - COASTAL ORDER TRACKING & FINANCIAL SYSTEM';
  sheet1.getCell('A1').font = titleFont;
  sheet1.getCell('A1').fill = navyHeaderFill;
  sheet1.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet1.getRow(1).height = 30;

  sheet1.mergeCells('A2:D2');
  sheet1.getCell('A2').value = `Ramapuram Beach, Chirala (Choramandal Coast) • Owner Account: anchorcafe01@gmail.com`;
  sheet1.getCell('A2').font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FFC9A86A' } };
  sheet1.getCell('A2').fill = navyHeaderFill;
  sheet1.getCell('A2').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet1.getRow(2).height = 20;

  sheet1.mergeCells('A3:D3');
  sheet1.getCell('A3').value = `MONTHLY FINANCIAL & OPERATING REPORT: ${monthName.toUpperCase()}`;
  sheet1.getCell('A3').font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet1.getCell('A3').fill = subHeaderFill;
  sheet1.getCell('A3').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet1.getRow(3).height = 24;

  sheet1.addRow([]);

  // P&L Metrics Table Header
  const pnlHeader = sheet1.addRow(['Core Operating Financial Metric', 'Monthly Amount (INR)', 'Margin / Ratio', 'Strategic Health & Verdict']);
  pnlHeader.font = whiteBoldFont;
  pnlHeader.eachCell(cell => {
    cell.fill = subHeaderFill;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  pnlHeader.height = 24;

  const pnlRows = [
    ['Total Gross Customer Sales', fin.totalGrossSales || 0, '100.0%', 'Month-to-date customer billing across tables & takeaways'],
    ['Total Raw Material Spend', fin.totalExpenses || 0, `${fin.totalGrossSales > 0 ? Math.round((fin.totalExpenses / fin.totalGrossSales) * 100) : 0}%`, 'Cost of milk, coffee beans, syrups, ice, packaging & groceries'],
    ['Net Operating Cash Profit', fin.netOperatingProfit || 0, `${fin.monthlyMarginPct || 0}%`, fin.verdict === 'HEALTHY_PROFIT' ? '🟢 Highly Profitable' : '🟡 Balanced / Procurement Phase'],
    ['Total Customer Orders Settled', data.summaryTotals?.[0]?.totalOrders || 0, '—', 'Total successful bills generated'],
    ['Total Cafe Offerings Served', data.summaryTotals?.[0]?.totalItemsSold || 0, '—', 'Cumulative units served across categories'],
    ['Average Order Value (AOV)', Math.round(data.summaryTotals?.[0]?.averageOrderValue || 0), '—', 'Average ticket size per dining group'],
    ['Daily Raw Material Burn Rate', fin.avgDailyExpense || 0, '—', 'Average daily cash expenditure on ingredients']
  ];

  pnlRows.forEach((r, idx) => {
    const row = sheet1.addRow(r);
    row.font = regularFont;
    row.eachCell((cell, colNum) => {
      cell.border = thinBorder;
      if (colNum === 2) {
        cell.numFmt = idx === 3 || idx === 4 ? '#,##0' : '₹ #,##0.00';
        cell.alignment = { horizontal: 'right' };
        if (idx === 2) {
          cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: (fin.netOperatingProfit || 0) >= 0 ? 'FF059669' : 'FFDC2626' } };
        }
      } else if (colNum === 3) {
        cell.alignment = { horizontal: 'center' };
      }
    });
    row.height = 20;
  });

  sheet1.addRow([]);

  // Payment Reconciliation Sub-Table
  const payHeader = sheet1.addRow(['Payment Settlement Mode', 'Revenue Settled (INR)', 'Transactions Count', '% Share of Revenue']);
  payHeader.font = whiteBoldFont;
  payHeader.eachCell(cell => {
    cell.fill = subHeaderFill;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  payHeader.height = 22;

  const totalRev = fin.totalGrossSales || 1;
  (data.paymentBreakdown || []).forEach(p => {
    const pct = Math.round(((p.methodRevenue || 0) / totalRev) * 100);
    const row = sheet1.addRow([
      p._id || 'OTHER',
      p.methodRevenue || 0,
      p.transactionCount || 0,
      `${pct}%`
    ]);
    row.font = regularFont;
    row.eachCell((cell, colNum) => {
      cell.border = thinBorder;
      if (colNum === 2) { cell.numFmt = '₹ #,##0.00'; cell.alignment = { horizontal: 'right' }; }
      if (colNum === 3 || colNum === 4) { cell.alignment = { horizontal: 'center' }; }
    });
    row.height = 19;
  });

  // Set explicit column widths for Tab 1
  sheet1.getColumn(1).width = 38;
  sheet1.getColumn(2).width = 24;
  sheet1.getColumn(3).width = 18;
  sheet1.getColumn(4).width = 50;

  // =========================================================================
  // TAB 2: 📅 Day-by-Day Financial Ledger
  // =========================================================================
  const sheet2 = workbook.addWorksheet('📅 Daily Ledger', {
    views: [{ showGridLines: true }]
  });

  sheet2.mergeCells('A1:J1');
  sheet2.getCell('A1').value = `📅 DAY-BY-DAY FINANCIAL & OPERATING LEDGER (${monthName.toUpperCase()})`;
  sheet2.getCell('A1').font = titleFont;
  sheet2.getCell('A1').fill = navyHeaderFill;
  sheet2.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet2.getRow(1).height = 28;

  const ledgerHeaders = [
    'Day',
    'Date (DD-MM-YYYY)',
    'Weekday',
    'Gross Sales (INR)',
    'Raw Material Spend (INR)',
    'Net Profit (INR)',
    'Margin (%)',
    'Orders Count',
    'Operating Health Status',
    'Managerial Decision & Notes'
  ];

  const lHeaderRow = sheet2.addRow(ledgerHeaders);
  lHeaderRow.font = whiteBoldFont;
  lHeaderRow.eachCell(cell => {
    cell.fill = subHeaderFill;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  lHeaderRow.height = 24;

  const startDataRow = 3;
  (data.dailyLedger || []).forEach(d => {
    const row = sheet2.addRow([
      d.day,
      d.date,
      d.dayName,
      d.grossSales || 0,
      d.rawMaterialExpenses || 0,
      d.netProfit || 0,
      (d.marginPct || 0) / 100,
      d.ordersCount || 0,
      d.status || 'IDLE',
      d.decision || 'No Activity'
    ]);
    row.font = regularFont;
    row.eachCell((cell, colNum) => {
      cell.border = thinBorder;
      if (colNum === 1) cell.alignment = { horizontal: 'center' };
      if (colNum === 2) cell.alignment = { horizontal: 'center' };
      if (colNum === 3) cell.alignment = { horizontal: 'center' };
      if (colNum === 4 || colNum === 5 || colNum === 6) {
        cell.numFmt = '₹ #,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
      if (colNum === 7) {
        cell.numFmt = '0.0%';
        cell.alignment = { horizontal: 'right' };
      }
      if (colNum === 8) cell.alignment = { horizontal: 'center' };
    });
    row.height = 19;
  });

  const endDataRow = sheet2.rowCount;

  // Add Totals Summary Row
  const totalLedgerRow = sheet2.addRow([
    'TOTAL',
    monthName,
    'ALL DAYS',
    { formula: `SUM(D${startDataRow}:D${endDataRow})` },
    { formula: `SUM(E${startDataRow}:E${endDataRow})` },
    { formula: `SUM(F${startDataRow}:F${endDataRow})` },
    { formula: `IF(D${endDataRow + 1}>0, F${endDataRow + 1}/D${endDataRow + 1}, 0)` },
    { formula: `SUM(H${startDataRow}:H${endDataRow})` },
    'MONTH CLOSING',
    `Audit closed for ${monthName}`
  ]);
  totalLedgerRow.font = darkBoldFont;
  totalLedgerRow.eachCell((cell, colNum) => {
    cell.fill = totalsRowFill;
    cell.border = doubleBottomBorder;
    if (colNum >= 4 && colNum <= 6) {
      cell.numFmt = '₹ #,##0.00';
      cell.alignment = { horizontal: 'right' };
    }
    if (colNum === 7) {
      cell.numFmt = '0.0%';
      cell.alignment = { horizontal: 'right' };
    }
    if (colNum === 8) cell.alignment = { horizontal: 'center' };
  });
  totalLedgerRow.height = 22;

  // Set Auto Column Widths for Sheet 2
  sheet2.getColumn(1).width = 8;
  sheet2.getColumn(2).width = 16;
  sheet2.getColumn(3).width = 12;
  sheet2.getColumn(4).width = 20;
  sheet2.getColumn(5).width = 24;
  sheet2.getColumn(6).width = 20;
  sheet2.getColumn(7).width = 14;
  sheet2.getColumn(8).width = 14;
  sheet2.getColumn(9).width = 24;
  sheet2.getColumn(10).width = 40;

  // =========================================================================
  // TAB 3: 🛒 Raw Material Procurement
  // =========================================================================
  const sheet3 = workbook.addWorksheet('🛒 Raw Material Expenses', {
    views: [{ showGridLines: true }]
  });

  sheet3.mergeCells('A1:G1');
  sheet3.getCell('A1').value = `🛒 RAW MATERIAL & CAFE PROCUREMENT LEDGER (${monthName.toUpperCase()})`;
  sheet3.getCell('A1').font = titleFont;
  sheet3.getCell('A1').fill = navyHeaderFill;
  sheet3.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet3.getRow(1).height = 28;

  const expHeaders = [
    'Purchase Date',
    'Raw Material / Item Description',
    'Category',
    'Cost Amount (INR)',
    'Payment Source / Deducted From',
    'Supplier / Bill Notes',
    'Recorded By'
  ];

  const expHeaderRow = sheet3.addRow(expHeaders);
  expHeaderRow.font = whiteBoldFont;
  expHeaderRow.eachCell(cell => {
    cell.fill = subHeaderFill;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  expHeaderRow.height = 24;

  const startExpRow = 3;
  (data.rawMaterialExpenses || []).forEach(e => {
    const dStr = new Date(e.expenseDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    const row = sheet3.addRow([
      dStr,
      e.title || 'Untitled Material',
      e.category || 'MISC_EXPENSE',
      e.amount || 0,
      e.deductedFrom || 'TODAYS_SALES',
      e.notes || '—',
      e.recordedBy || 'Counter 1'
    ]);
    row.font = regularFont;
    row.eachCell((cell, colNum) => {
      cell.border = thinBorder;
      if (colNum === 1) cell.alignment = { horizontal: 'center' };
      if (colNum === 3) cell.alignment = { horizontal: 'center' };
      if (colNum === 4) {
        cell.numFmt = '₹ #,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
    row.height = 19;
  });

  const endExpRow = sheet3.rowCount;
  if (endExpRow >= startExpRow) {
    const totalExpRow = sheet3.addRow([
      'TOTAL PROCURED',
      `${data.rawMaterialExpenses?.length || 0} Purchase Entries`,
      'ALL CATEGORIES',
      { formula: `SUM(D${startExpRow}:D${endExpRow})` },
      '—',
      'Full monthly raw material expenditures',
      'System Audit'
    ]);
    totalExpRow.font = darkBoldFont;
    totalExpRow.eachCell((cell, colNum) => {
      cell.fill = totalsRowFill;
      cell.border = doubleBottomBorder;
      if (colNum === 4) {
        cell.numFmt = '₹ #,##0.00';
        cell.alignment = { horizontal: 'right' };
      }
    });
    totalExpRow.height = 22;
  }

  sheet3.getColumn(1).width = 16;
  sheet3.getColumn(2).width = 38;
  sheet3.getColumn(3).width = 22;
  sheet3.getColumn(4).width = 20;
  sheet3.getColumn(5).width = 26;
  sheet3.getColumn(6).width = 36;
  sheet3.getColumn(7).width = 18;

  // =========================================================================
  // TAB 4: 🍕 Category Sales & Bestsellers
  // =========================================================================
  const sheet4 = workbook.addWorksheet('🍕 Sales Velocity & Menu', {
    views: [{ showGridLines: true }]
  });

  sheet4.mergeCells('A1:C1');
  sheet4.getCell('A1').value = '🍕 CATEGORY-WISE SALES VELOCITY';
  sheet4.getCell('A1').font = titleFont;
  sheet4.getCell('A1').fill = navyHeaderFill;
  sheet4.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  sheet4.getRow(1).height = 28;

  const catHead = sheet4.addRow(['Menu Category', 'Units Sold', 'Total Revenue (INR)']);
  catHead.font = whiteBoldFont;
  catHead.eachCell(cell => {
    cell.fill = subHeaderFill;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  catHead.height = 22;

  (data.categoryBreakdown || []).forEach(c => {
    const row = sheet4.addRow([c._id || 'Other', c.count || 0, c.revenue || 0]);
    row.font = regularFont;
    row.eachCell((cell, colNum) => {
      cell.border = thinBorder;
      if (colNum === 2) cell.alignment = { horizontal: 'center' };
      if (colNum === 3) { cell.numFmt = '₹ #,##0.00'; cell.alignment = { horizontal: 'right' }; }
    });
    row.height = 19;
  });

  sheet4.addRow([]);
  sheet4.addRow([]);

  // Top 10 Bestsellers Section
  const bestHeadTitle = sheet4.addRow(['🌟 TOP 10 BESTSELLING COASTAL OFFERINGS', '', '']);
  sheet4.mergeCells(`A${bestHeadTitle.number}:C${bestHeadTitle.number}`);
  bestHeadTitle.getCell(1).font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: 'FFFFFFFF' } };
  bestHeadTitle.getCell(1).fill = navyHeaderFill;
  bestHeadTitle.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  bestHeadTitle.height = 26;

  const bestHead = sheet4.addRow(['Item Title', 'Quantity Sold', 'Revenue Generated (INR)']);
  bestHead.font = whiteBoldFont;
  bestHead.eachCell(cell => {
    cell.fill = subHeaderFill;
    cell.border = thinBorder;
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  bestHead.height = 22;

  (data.topBestsellers || []).forEach(b => {
    const row = sheet4.addRow([b._id || 'Unknown', b.quantitySold || 0, b.itemRevenue || 0]);
    row.font = regularFont;
    row.eachCell((cell, colNum) => {
      cell.border = thinBorder;
      if (colNum === 2) cell.alignment = { horizontal: 'center' };
      if (colNum === 3) { cell.numFmt = '₹ #,##0.00'; cell.alignment = { horizontal: 'right' }; }
    });
    row.height = 19;
  });

  sheet4.getColumn(1).width = 38;
  sheet4.getColumn(2).width = 18;
  sheet4.getColumn(3).width = 24;

  return await workbook.xlsx.writeBuffer();
}

module.exports = {
  generateMonthlyExcelWorkbook
};
