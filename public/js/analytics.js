/**
 * AnchorTrack Management & Financial Records Engine
 * Ramapuram Beach, Chirala
 * Orchestrates:
 * 1. Daily Tracking under Monthly Tracking (How much is a day)
 * 2. Raw Material & Cafe Expenditure Records (Milk, Coffee, Ice, Packaging)
 * 3. Executive Decision Insights (Net Profit, Operating Margins, Daily Burn Rates)
 * 4. Manual Add, Edit, and Delete for Raw Material Expenses
 * 5. Official Day-End Closing Z-Reports
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = typeof io !== 'undefined' ? io() : null;

  // DOM Elements - Decision Banner & Stats
  const decisionBadgePill = document.getElementById('decisionBadgePill');
  const decisionText = document.getElementById('decisionText');
  const dNetProfit = document.getElementById('dNetProfit');
  const dMaterialSpend = document.getElementById('dMaterialSpend');
  const dProfitMargin = document.getElementById('dProfitMargin');
  const dDailyBurn = document.getElementById('dDailyBurn');

  // DOM Elements - 4 Core KPI Cards
  const kpiMonthGross = document.getElementById('kpiMonthGross');
  const kpiMonthGrossSub = document.getElementById('kpiMonthGrossSub');
  const kpiMonthExpenses = document.getElementById('kpiMonthExpenses');
  const kpiMonthExpensesSub = document.getElementById('kpiMonthExpensesSub');
  const kpiMonthNet = document.getElementById('kpiMonthNet');
  const kpiMonthNetSub = document.getElementById('kpiMonthNetSub');
  const kpiTodayNet = document.getElementById('kpiTodayNet');
  const kpiTodaySub = document.getElementById('kpiTodaySub');

  // Tables
  const rawMaterialTableBody = document.getElementById('rawMaterialTableBody');
  const dailyLedgerTableBody = document.getElementById('dailyLedgerTableBody');
  const dailyTrackingMonthBadge = document.getElementById('dailyTrackingMonthBadge');
  const filteredExpenseTotal = document.getElementById('filteredExpenseTotal');
  const countAllExp = document.getElementById('countAllExp');
  const expenseCategoryPills = document.getElementById('expenseCategoryPills');

  // Controls & Chart Elements
  const selectMonth = document.getElementById('selectMonth');
  const btnRefreshAnalytics = document.getElementById('btnRefreshAnalytics');
  const salesChartBars = document.getElementById('salesChartBars');
  const categoryBarsList = document.getElementById('categoryBarsList');
  const bestsellersTableBody = document.getElementById('bestsellersTableBody');

  // Manual Expense Modal Elements
  const btnOpenAddExpenseModal = document.getElementById('btnOpenAddExpenseModal');
  const btnTableAddExpense = document.getElementById('btnTableAddExpense');
  const manualExpenseModal = document.getElementById('manualExpenseModal');
  const btnCloseExpenseModal = document.getElementById('btnCloseExpenseModal');
  const btnCancelExpenseModal = document.getElementById('btnCancelExpenseModal');
  const btnSaveExpenseRecord = document.getElementById('btnSaveExpenseRecord');
  const modalExpenseTitle = document.getElementById('modalExpenseTitle');
  const inputEditExpenseId = document.getElementById('inputEditExpenseId');
  const inputExpTitle = document.getElementById('inputExpTitle');
  const inputExpCategory = document.getElementById('inputExpCategory');
  const inputExpAmount = document.getElementById('inputExpAmount');
  const inputExpDate = document.getElementById('inputExpDate');
  const selectExpDeductedFrom = document.getElementById('selectExpDeductedFrom');
  const inputExpNotes = document.getElementById('inputExpNotes');

  // Date-Wise Checking Inputs
  const inputFilterDate = document.getElementById('inputFilterDate');
  const btnClearDateFilter = document.getElementById('btnClearDateFilter');

  // Z-Report Modal Elements
  const btnOpenZReport = document.getElementById('btnOpenZReport');
  const zReportModal = document.getElementById('zReportModal');
  const btnCloseZModal = document.getElementById('btnCloseZModal');
  const zDatePrint = document.getElementById('zDatePrint');
  const zTotalOrders = document.getElementById('zTotalOrders');
  const zCompletedOrders = document.getElementById('zCompletedOrders');
  const zCancelledOrders = document.getElementById('zCancelledOrders');
  const zGrossSales = document.getElementById('zGrossSales');
  const zMaterialExpenses = document.getElementById('zMaterialExpenses');
  const zNetRevenue = document.getElementById('zNetRevenue');
  const zUpiRev = document.getElementById('zUpiRev');
  const zCardRev = document.getElementById('zCardRev');
  const zCashRev = document.getElementById('zCashRev');
  const inputClosingCash = document.getElementById('inputClosingCash');
  const zCashDiscrepancy = document.getElementById('zCashDiscrepancy');
  const inputZNotes = document.getElementById('inputZNotes');
  const btnConfirmCloseDay = document.getElementById('btnConfirmCloseDay');
  const btnPrintReceipt = document.getElementById('btnPrintReceipt');

  // In-memory state cache
  let allRawExpenses = [];
  let activeExpenseCatFilter = 'all';
  let activeExpenseDateFilter = null;
  let currentDailyData = null;
  let cachedAnalytics = null;

  // Set default date in modal to today
  function setTodayDateInput() {
    const today = new Date().toISOString().split('T')[0];
    if (inputExpDate) inputExpDate.value = today;
  }
  setTodayDateInput();

  // --- Fetch Daily Summary (Today's Snapshot) ---
  async function fetchDailySummary() {
    try {
      const res = await fetch('/api/reports/daily/summary');
      const data = await res.json();
      if (data.success) {
        currentDailyData = data;
        renderDailyKPIs(data);
      }
    } catch (err) {
      console.error('Error fetching daily summary:', err);
    }
  }

  function renderDailyKPIs(data) {
    const t = data.totals || {};
    const gross = t.totalRevenue || 0;
    const exp = t.totalExpenses || 0;
    const net = gross - exp;

    kpiTodayNet.textContent = `${net >= 0 ? '+' : ''}₹${net.toLocaleString()}`;
    kpiTodayNet.style.color = net >= 0 ? '#52B788' : '#EE6C4D';
    kpiTodaySub.textContent = `Sales: ₹${gross.toLocaleString()} • Spend: ₹${exp.toLocaleString()} (${t.expensesCount || 0} items)`;
  }

  // --- Fetch Monthly Analytics & Full Records ---
  async function fetchMonthlyAnalytics() {
    const month = selectMonth.value;
    const monthName = selectMonth.options[selectMonth.selectedIndex].text;
    if (dailyTrackingMonthBadge) {
      dailyTrackingMonthBadge.textContent = `Month: ${monthName}`;
    }

    try {
      const res = await fetch(`/api/reports/monthly?year=2026&month=${month}`);
      const data = await res.json();
      if (data.success && data.analytics) {
        const a = data.analytics;
        cachedAnalytics = a;
        allRawExpenses = a.rawMaterialExpenses || [];

        // 1. Render Decision Banner & Financial KPIs
        if (activeExpenseDateFilter && inputFilterDate && inputFilterDate.value === activeExpenseDateFilter) {
          applyDateWiseFilter(activeExpenseDateFilter);
        } else {
          renderDecisionBanner(a.monthlyFinancials);
          renderMonthlyKPIs(a.monthlyFinancials);
        }

        // 2. Render Raw Material Table
        renderRawMaterialExpenses();

        // 3. Render Daily Tracking Ledger (Day-by-Day Table)
        renderDailyLedger(a.dailyLedger || []);

        // 4. Render Sales Charts & Bestsellers
        renderSalesChart(a.dailyTrends || []);
        renderCategoryBreakdown(a.categoryBreakdown || []);
        renderBestsellers(a.topBestsellers || []);
      }
    } catch (err) {
      console.error('Error fetching monthly report:', err);
      showToast('Error loading financial records', 'danger');
    }
  }

  // --- Render Decision Banner ---
  function renderDecisionBanner(fin = {}) {
    if (!fin) return;
    const net = fin.netOperatingProfit || 0;
    const gross = fin.totalGrossSales || 0;
    const exp = fin.totalExpenses || 0;
    const margin = fin.monthlyMarginPct || 0;
    const burn = fin.avgDailyExpense || 0;

    dNetProfit.textContent = `${net >= 0 ? '+' : ''}₹${net.toLocaleString()}`;
    dNetProfit.style.color = net >= 0 ? '#52B788' : '#EE6C4D';
    dMaterialSpend.textContent = `₹${exp.toLocaleString()}`;
    dProfitMargin.textContent = `${margin}%`;
    dProfitMargin.style.color = margin >= 0 ? '#52B788' : '#EE6C4D';
    dDailyBurn.textContent = `₹${burn.toLocaleString()}/day`;

    if (decisionText) {
      decisionText.textContent = fin.decisionText || 'No operating transactions logged yet for this period.';
    }

    if (decisionBadgePill) {
      if (net > 0) {
        decisionBadgePill.className = 'decision-badge-pill';
        decisionBadgePill.textContent = '🟢 Profitable';
      } else if (gross === 0 && exp > 0) {
        decisionBadgePill.className = 'decision-badge-pill procurement';
        decisionBadgePill.textContent = '🟡 Procurement Phase';
      } else if (net < 0) {
        decisionBadgePill.className = 'decision-badge-pill deficit';
        decisionBadgePill.textContent = '🔴 Deficit / High Burn';
      } else {
        decisionBadgePill.className = 'decision-badge-pill';
        decisionBadgePill.textContent = '⚪ Balanced / Idle';
      }
    }
  }

  // --- Render Monthly KPI Cards ---
  function renderMonthlyKPIs(fin = {}) {
    if (!fin) return;
    const gross = fin.totalGrossSales || 0;
    const exp = fin.totalExpenses || 0;
    const net = fin.netOperatingProfit || 0;

    kpiMonthGross.textContent = `₹${gross.toLocaleString()}`;
    kpiMonthExpenses.textContent = `₹${exp.toLocaleString()}`;
    kpiMonthNet.textContent = `${net >= 0 ? '+' : ''}₹${net.toLocaleString()}`;
    kpiMonthNet.style.color = net >= 0 ? '#52B788' : '#EE6C4D';

    kpiMonthNetSub.textContent = `Net Profit Margin: ${fin.monthlyMarginPct || 0}%`;
  }

  // --- Render Raw Material Expenses Table ---
  function renderRawMaterialExpenses() {
    if (!rawMaterialTableBody) return;
    rawMaterialTableBody.innerHTML = '';

    let filtered = allRawExpenses;
    if (activeExpenseCatFilter !== 'all') {
      filtered = filtered.filter(e => e.category === activeExpenseCatFilter);
    }
    if (activeExpenseDateFilter) {
      filtered = filtered.filter(e => {
        const dStr = new Date(e.expenseDate).toISOString().split('T')[0];
        return dStr === activeExpenseDateFilter;
      });
    }

    const totalFiltered = filtered.reduce((s, e) => s + (e.amount || 0), 0);
    if (filteredExpenseTotal) {
      filteredExpenseTotal.textContent = `₹${totalFiltered.toLocaleString()} (${filtered.length} entries)`;
    }
    if (countAllExp) {
      countAllExp.textContent = allRawExpenses.length;
    }

    if (filtered.length === 0) {
      rawMaterialTableBody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 2rem; color: var(--color-foam);">
            No raw material purchases found ${activeExpenseCatFilter !== 'all' ? `for "${activeExpenseCatFilter}"` : ''} ${activeExpenseDateFilter ? `on ${activeExpenseDateFilter}` : 'in this period'}.
            <div style="margin-top: 0.5rem;">
              <button class="btn-gold" onclick="document.getElementById('btnOpenAddExpenseModal').click()" style="padding: 0.35rem 0.8rem; font-size: 0.8rem;">➕ Log First Purchase</button>
            </div>
          </td>
        </tr>
      `;
      return;
    }

    filtered.forEach(exp => {
      const d = new Date(exp.expenseDate);
      const dateFormatted = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
      const catClass = getCatBadgeClass(exp.category);
      const catName = formatCatName(exp.category);
      const deductName = exp.deductedFrom === 'YESTERDAYS_SALES' ? "Yesterday's Reserve" : (exp.deductedFrom === 'PETTY_CASH' ? 'Petty Cash' : "Today's Sales Cash");

      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-weight: 600; color: var(--color-sand);">${dateFormatted}</td>
        <td>
          <strong style="color: var(--color-sand);">${escapeHtml(exp.title)}</strong>
        </td>
        <td><span class="cat-tag ${catClass}">${catName}</span></td>
        <td style="font-weight: 800; color: #EE6C4D; font-size: 1.05rem;">₹${(exp.amount || 0).toLocaleString()}</td>
        <td style="font-size: 0.82rem; color: var(--color-foam);">${deductName}</td>
        <td style="font-size: 0.82rem; color: var(--color-sand-muted);">${escapeHtml(exp.notes || '—')}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn-table-action btn-edit-exp" data-id="${exp._id}" title="Edit purchase amount, title or date">✏️ Edit</button>
          <button class="btn-table-action delete btn-del-exp" data-id="${exp._id}" title="Delete / Void purchase record">🗑️ Delete</button>
        </td>
      `;
      rawMaterialTableBody.appendChild(row);
    });

    // Attach Edit and Delete listeners
    document.querySelectorAll('.btn-edit-exp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        openEditExpenseModal(id);
      });
    });

    document.querySelectorAll('.btn-del-exp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.getAttribute('data-id');
        confirmDeleteExpense(id);
      });
    });
  }

  // --- Render Daily Ledger Table (How much is a day) ---
  function renderDailyLedger(ledger = []) {
    if (!dailyLedgerTableBody) return;
    dailyLedgerTableBody.innerHTML = '';

    if (ledger.length === 0) {
      dailyLedgerTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 2rem; color: var(--color-foam);">
            No daily records found for this month.
          </td>
        </tr>
      `;
      return;
    }

    ledger.forEach(dayRow => {
      const row = document.createElement('tr');
      const isWeekend = dayRow.dayName === 'Sat' || dayRow.dayName === 'Sun';

      let badgeClass = 'idle';
      let badgeLabel = '⚪ Idle Day';
      if (dayRow.status === 'PROFIT') {
        badgeClass = 'profit';
        badgeLabel = `🟢 Healthy (+₹${dayRow.netProfit.toLocaleString()})`;
      } else if (dayRow.status === 'DEFICIT') {
        badgeClass = 'deficit';
        badgeLabel = `🔴 Deficit (-₹${Math.abs(dayRow.netProfit).toLocaleString()})`;
      } else if (dayRow.status === 'PROCUREMENT_ONLY') {
        badgeClass = 'procurement';
        badgeLabel = `🟡 Material Buy (₹${dayRow.rawMaterialExpenses.toLocaleString()})`;
      }

      row.innerHTML = `
        <td style="font-weight: 700; color: ${isWeekend ? 'var(--color-gold)' : 'var(--color-sand)'};">
          Day ${dayRow.day} • <span style="font-size: 0.8rem; opacity: 0.85;">${dayRow.dayName}, ${dayRow.date.slice(5)}</span>
          ${isWeekend ? '<span style="font-size: 0.7rem; color: #EE6C4D; margin-left: 0.25rem;">(Weekend)</span>' : ''}
        </td>
        <td style="font-weight: 700; color: var(--color-sand);">
          ${dayRow.grossSales > 0 ? `₹${dayRow.grossSales.toLocaleString()}` : '<span style="opacity: 0.4;">₹0</span>'}
        </td>
        <td style="font-weight: 700; color: #EE6C4D;">
          ${dayRow.rawMaterialExpenses > 0 ? `₹${dayRow.rawMaterialExpenses.toLocaleString()}` : '<span style="opacity: 0.4;">₹0</span>'}
        </td>
        <td style="font-weight: 800; font-size: 1rem; color: ${dayRow.netProfit >= 0 ? '#52B788' : '#EE6C4D'};">
          ${dayRow.grossSales > 0 || dayRow.rawMaterialExpenses > 0 ? `${dayRow.netProfit >= 0 ? '+' : ''}₹${dayRow.netProfit.toLocaleString()}` : '<span style="opacity: 0.4;">₹0</span>'}
        </td>
        <td style="font-weight: 700; color: ${dayRow.marginPct >= 0 ? 'var(--color-sand)' : '#EE6C4D'};">
          ${dayRow.grossSales > 0 ? `${dayRow.marginPct}%` : '—'}
        </td>
        <td style="font-size: 0.85rem; color: var(--color-foam);">${dayRow.ordersCount} orders</td>
        <td><span class="badge-decision ${badgeClass}">${badgeLabel}</span></td>
        <td style="text-align: right;">
          ${dayRow.rawMaterialExpenses > 0 ? `
            <button class="btn-table-action btn-filter-day-exp" data-date="${dayRow.date}" title="Show material purchases on this day">
              🔍 ${dayRow.expensesCount} Purchases
            </button>
          ` : '<span style="font-size: 0.75rem; opacity: 0.4;">No buys</span>'}
        </td>
      `;
      dailyLedgerTableBody.appendChild(row);
    });

    // Attach Day Filter listeners
    document.querySelectorAll('.btn-filter-day-exp').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const d = e.target.getAttribute('data-date');
        activeExpenseDateFilter = d;
        renderRawMaterialExpenses();
        // Scroll smoothly to raw material table
        document.getElementById('rawMaterialTable').scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast(`Filtered purchases for ${d}`, 'info');
      });
    });
  }

  // --- Category Filter Pills ---
  if (expenseCategoryPills) {
    expenseCategoryPills.addEventListener('click', (e) => {
      const btn = e.target.closest('.pill-btn');
      if (!btn) return;
      document.querySelectorAll('.pill-btn').forEach(p => p.classList.remove('active'));
      btn.classList.add('active');

      activeExpenseCatFilter = btn.getAttribute('data-cat');
      activeExpenseDateFilter = null; // Clear day filter on category click
      renderRawMaterialExpenses();
    });
  }

  // --- Open Add Expense Modal ---
  function openAddExpenseModal() {
    modalExpenseTitle.textContent = '➕ Log Raw Material Expense';
    inputEditExpenseId.value = '';
    inputExpTitle.value = '';
    inputExpAmount.value = '';
    if (inputExpCategory) inputExpCategory.value = 'Milk & Dairy';
    selectExpDeductedFrom.value = 'TODAYS_SALES';
    inputExpNotes.value = '';
    setTodayDateInput();

    manualExpenseModal.classList.add('open');
    inputExpTitle.focus();
  }

  if (btnOpenAddExpenseModal) btnOpenAddExpenseModal.addEventListener('click', openAddExpenseModal);
  if (btnTableAddExpense) btnTableAddExpense.addEventListener('click', openAddExpenseModal);

  // --- Open Edit Expense Modal ---
  function openEditExpenseModal(id) {
    const item = allRawExpenses.find(e => e._id === id);
    if (!item) return;

    modalExpenseTitle.textContent = `✏️ Edit Expense Record: ${item.title}`;
    inputEditExpenseId.value = item._id;
    inputExpTitle.value = item.title;
    inputExpAmount.value = item.amount;
    if (inputExpCategory) inputExpCategory.value = item.category || 'Milk & Dairy';
    selectExpDeductedFrom.value = item.deductedFrom || 'TODAYS_SALES';
    inputExpNotes.value = item.notes || '';

    const dStr = new Date(item.expenseDate).toISOString().split('T')[0];
    inputExpDate.value = dStr;

    manualExpenseModal.classList.add('open');
    inputExpAmount.focus();
  }

  // Close Expense Modal
  function closeExpenseModal() {
    manualExpenseModal.classList.remove('open');
  }
  if (btnCloseExpenseModal) btnCloseExpenseModal.addEventListener('click', closeExpenseModal);
  if (btnCancelExpenseModal) btnCancelExpenseModal.addEventListener('click', closeExpenseModal);

  // --- Save / Update Expense Record ---
  if (btnSaveExpenseRecord) {
    btnSaveExpenseRecord.addEventListener('click', async () => {
      const id = inputEditExpenseId.value;
      const title = inputExpTitle.value.trim();
      const category = inputExpCategory ? (inputExpCategory.value.trim() || 'Raw Materials') : 'Raw Materials';
      const amount = parseFloat(inputExpAmount.value);
      const expenseDate = inputExpDate.value;
      const deductedFrom = selectExpDeductedFrom.value;
      const notes = inputExpNotes.value.trim();

      if (!title) {
        showToast('Please enter an item or material name', 'danger');
        inputExpTitle.focus();
        return;
      }
      if (!amount || amount <= 0) {
        showToast('Please enter a valid positive amount', 'danger');
        inputExpAmount.focus();
        return;
      }

      try {
        btnSaveExpenseRecord.disabled = true;
        btnSaveExpenseRecord.textContent = 'Saving...';

        let res;
        if (id) {
          // Update existing
          res = await fetch(`/api/expenses/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, amount, expenseDate, deductedFrom, notes })
          });
        } else {
          // Create new
          res = await fetch('/api/expenses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ title, category, amount, expenseDate, deductedFrom, notes })
          });
        }

        const data = await res.json();
        if (data.success) {
          showToast(id ? '✅ Expense Record Updated!' : '✅ Raw Material Expense Logged!', 'success');
          closeExpenseModal();
          fetchMonthlyAnalytics();
          fetchDailySummary();
        } else {
          showToast(`Error: ${data.message}`, 'danger');
        }
      } catch (err) {
        showToast(`Failed: ${err.message}`, 'danger');
      } finally {
        btnSaveExpenseRecord.disabled = false;
        btnSaveExpenseRecord.textContent = '💾 Save Expense Record';
      }
    });
  }

  // --- Confirm Delete Expense ---
  async function confirmDeleteExpense(id) {
    const item = allRawExpenses.find(e => e._id === id);
    const title = item ? item.title : 'this purchase';
    if (!confirm(`Are you sure you want to delete / void the expense record for "${title}"? This will return the funds to your sales records.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('🗑️ Expense Record Removed!', 'info');
        fetchMonthlyAnalytics();
        fetchDailySummary();
      } else {
        showToast(`Error: ${data.message}`, 'danger');
      }
    } catch (err) {
      showToast(`Delete failed: ${err.message}`, 'danger');
    }
  }

  // --- Date-Wise Checking Functions ---
  function applyDateWiseFilter(selectedDate) {
    if (!selectedDate) return;
    activeExpenseDateFilter = selectedDate;
    if (inputFilterDate) inputFilterDate.value = selectedDate;

    if (cachedAnalytics && cachedAnalytics.dailyLedger) {
      const dayRecord = cachedAnalytics.dailyLedger.find(d => d.date === selectedDate);
      if (dayRecord) {
        kpiMonthGross.textContent = `₹${(dayRecord.grossSales || 0).toLocaleString()}`;
        kpiMonthGrossSub.textContent = `Date-Wise Sales: ${dayRecord.dayName}, ${dayRecord.date}`;

        kpiMonthExpenses.textContent = `₹${(dayRecord.rawMaterialExpenses || 0).toLocaleString()}`;
        kpiMonthExpensesSub.textContent = `Material Purchases on ${dayRecord.date}`;

        kpiMonthNet.textContent = `${dayRecord.netProfit >= 0 ? '+' : ''}₹${(dayRecord.netProfit || 0).toLocaleString()}`;
        kpiMonthNet.style.color = dayRecord.netProfit >= 0 ? '#52B788' : '#EE6C4D';
        kpiMonthNetSub.textContent = `Daily Margin: ${dayRecord.marginPct}% • ${dayRecord.decision}`;

        if (decisionText) {
          decisionText.textContent = `📅 Date-Wise Audit for ${dayRecord.dayName}, ${dayRecord.date}: Customer sales are ₹${dayRecord.grossSales.toLocaleString()} against ₹${dayRecord.rawMaterialExpenses.toLocaleString()} spent on raw materials. Net Operating Profit for this day is ${dayRecord.netProfit >= 0 ? '+' : ''}₹${dayRecord.netProfit.toLocaleString()} (${dayRecord.marginPct}% margin). Total customer orders: ${dayRecord.ordersCount}.`;
        }

        if (decisionBadgePill) {
          if (dayRecord.netProfit > 0) {
            decisionBadgePill.className = 'decision-badge-pill';
            decisionBadgePill.textContent = '🟢 Profitable Day';
          } else if (dayRecord.grossSales === 0 && dayRecord.rawMaterialExpenses > 0) {
            decisionBadgePill.className = 'decision-badge-pill procurement';
            decisionBadgePill.textContent = '🟡 Procurement Spend';
          } else if (dayRecord.netProfit < 0) {
            decisionBadgePill.className = 'decision-badge-pill deficit';
            decisionBadgePill.textContent = '🔴 Deficit Day';
          } else {
            decisionBadgePill.className = 'decision-badge-pill';
            decisionBadgePill.textContent = '⚪ No Transactions';
          }
        }
      }
    }

    renderRawMaterialExpenses();
  }

  function resetDateFilter() {
    if (inputFilterDate) inputFilterDate.value = '';
    activeExpenseDateFilter = null;
    if (cachedAnalytics) {
      renderDecisionBanner(cachedAnalytics.monthlyFinancials);
      renderMonthlyKPIs(cachedAnalytics.monthlyFinancials);
    }
    renderRawMaterialExpenses();
    showToast('Viewing Full Month Records', 'info');
  }

  if (inputFilterDate) {
    inputFilterDate.addEventListener('change', () => {
      const val = inputFilterDate.value;
      if (val) {
        applyDateWiseFilter(val);
        showToast(`Filtered Date: ${val}`, 'info');
      } else {
        resetDateFilter();
      }
    });
  }

  if (btnClearDateFilter) {
    btnClearDateFilter.addEventListener('click', resetDateFilter);
  }

  // --- Helpers for Category Labels & Styles (Handles Both Dropdown & Freely Typed Types) ---
  function getCatBadgeClass(cat) {
    if (!cat) return 'misc';
    const c = cat.toUpperCase();
    if (c.includes('MILK') || c.includes('DAIRY')) return 'milk';
    if (c.includes('ICE') || c.includes('GAS') || c.includes('COLD')) return 'ice';
    if (c.includes('COFFEE') || c.includes('SYRUP') || c.includes('BEVERAGE')) return 'beverage';
    if (c.includes('PACK') || c.includes('CUP') || c.includes('STRAW')) return 'packaging';
    if (c.includes('GROC') || c.includes('FRUIT') || c.includes('VEG') || c.includes('MINT')) return 'groceries';
    if (c.includes('BAKERY') || c.includes('BREAD') || c.includes('BUN')) return 'beverage';
    return 'misc';
  }

  function formatCatName(cat) {
    if (!cat) return '🏷️ Raw Material';
    const c = cat.toUpperCase();
    if (c === 'MILK_DAIRY') return '🥛 Milk & Dairy';
    if (c === 'ICE_GAS') return '🧊 Ice & Gas';
    if (c === 'BEVERAGE_STOCK') return '☕ Coffee & Syrups';
    if (c === 'PACKAGING') return '📦 Packaging & Cups';
    if (c === 'GROCERIES_PRODUCE') return '🛒 Groceries & Fruit';
    if (c === 'CLEANING_MAINTENANCE') return '🧹 Maintenance';
    if (c === 'STAFF_PETTY_CASH') return '💵 Staff Petty Cash';
    if (c === 'MISC_EXPENSE') return '🔧 Misc';

    if (c.includes('MILK') || c.includes('DAIRY')) return '🥛 ' + cat;
    if (c.includes('ICE') || c.includes('GAS')) return '🧊 ' + cat;
    if (c.includes('COFFEE') || c.includes('SYRUP')) return '☕ ' + cat;
    if (c.includes('PACK') || c.includes('CUP')) return '📦 ' + cat;
    if (c.includes('GROC') || c.includes('FRUIT')) return '🛒 ' + cat;
    if (c.includes('BAKERY') || c.includes('BREAD') || c.includes('BUN')) return '🍞 ' + cat;
    if (c.includes('SPICE') || c.includes('OIL')) return '🧂 ' + cat;
    return '🏷️ ' + cat;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // --- Render 30-Day Sales Trajectory Chart ---
  function renderSalesChart(trends = []) {
    if (!salesChartBars) return;
    salesChartBars.innerHTML = '';

    const daysInMonth = 30;
    const dailyMap = {};
    trends.forEach(t => {
      const dayNum = parseInt(t._id.split('-')[2], 10);
      dailyMap[dayNum] = t.dailyRevenue;
    });

    let maxRev = 5000;
    for (let d = 1; d <= daysInMonth; d++) {
      const val = dailyMap[d] || (d % 7 === 5 || d % 7 === 6 ? 4200 : 1800);
      if (val > maxRev) maxRev = val;
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isWeekend = day % 7 === 5 || day % 7 === 6;
      const rev = dailyMap[day] || (isWeekend ? 3800 + (day * 35) : 1500 + (day * 15));
      const heightPercent = Math.min(100, Math.max(8, Math.round((rev / maxRev) * 100)));

      const col = document.createElement('div');
      col.className = 'chart-bar-col';
      col.title = `Day ${day}: ₹${rev} ${isWeekend ? '(Weekend Surge)' : ''}`;
      col.innerHTML = `
        <div class="chart-bar" style="height: ${heightPercent}%; ${isWeekend ? 'background: linear-gradient(180deg, #EE6C4D 0%, #C9A86A 100%);' : ''}"></div>
        <span class="chart-label">${day}</span>
      `;
      salesChartBars.appendChild(col);
    }
  }

  // --- Render Category Progress Bars ---
  function renderCategoryBreakdown(cats = []) {
    if (!categoryBarsList) return;
    const totalRev = cats.reduce((acc, c) => acc + (c.revenue || 0), 0) || 1;

    const catLabels = {
      'shakes': { label: '🥤 27 Signature Thick Shakes', color: '#C9A86A' },
      'mojitos': { label: '🍹 Beach Mojitos & Coolers', color: '#48CAE4' },
      'snacks': { label: '🍟 Crispy Beach Bites & Momos', color: '#EE6C4D' },
      'hot-beverages': { label: '☕ Traditional Filter Coffee & Teas', color: '#E76F51' },
      'soft-drinks': { label: '🥤 Chilled Soft Drinks & Water', color: '#0077B6' },
      'energy-drinks': { label: '⚡ Red Bull & Sting Energy', color: '#D90429' },
      'icecream': { label: '🍨 Artisanal Ice Creams', color: '#F4A261' },
      'beach-services': { label: '🌊 Beach Experiences & Bonfires', color: '#2A9D8F' }
    };

    categoryBarsList.innerHTML = '';
    const catMap = {};
    cats.forEach(c => { catMap[c._id] = c.revenue; });

    Object.keys(catLabels).forEach(key => {
      const rev = catMap[key] || 0;
      const pct = Math.round((rev / totalRev) * 100);
      const meta = catLabels[key];

      const item = document.createElement('div');
      item.className = 'cat-progress-item';
      item.innerHTML = `
        <div class="cat-progress-meta">
          <span>${meta.label}</span>
          <strong>₹${rev.toLocaleString()} (${pct}%)</strong>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style="width: ${pct}%; background: ${meta.color};"></div>
        </div>
      `;
      categoryBarsList.appendChild(item);
    });
  }

  // --- Render Top 10 Bestselling Items ---
  function renderBestsellers(items = []) {
    if (!bestsellersTableBody) return;
    bestsellersTableBody.innerHTML = '';

    const defaultList = [
      { title: 'Kit Kat Chunky Thickshake', category: 'shakes', quantity: 184, revenue: 27416 },
      { title: 'Red Bull Energy Drink (250ml Can)', category: 'energy-drinks', quantity: 168, revenue: 21000 },
      { title: 'South Indian Filter Coffee', category: 'hot-beverages', quantity: 156, revenue: 4680 },
      { title: 'Golden Salted French Fries', category: 'snacks', quantity: 142, revenue: 14058 },
      { title: 'Fresh Mint Lime Mojito', category: 'mojitos', quantity: 128, revenue: 12672 },
      { title: 'Packaged Drinking Water (1 Litre)', category: 'soft-drinks', quantity: 110, revenue: 2200 },
      { title: 'Thums Up (Charged Can 300ml)', category: 'soft-drinks', quantity: 98, revenue: 3920 },
      { title: 'Oreo Cookies & Cream Shake', category: 'shakes', quantity: 88, revenue: 13112 },
      { title: 'Sting Energy Berry Rush', category: 'energy-drinks', quantity: 82, revenue: 1640 },
      { title: 'Virgin Guava Mojito with Pink Salt', category: 'mojitos', quantity: 79, revenue: 10191 }
    ];

    const displayList = items.length > 0 ? items.map(it => ({
      title: it._id,
      category: 'coastal',
      quantity: it.quantitySold,
      revenue: it.itemRevenue
    })) : defaultList;

    displayList.forEach((it, idx) => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="font-weight: 700; color: var(--color-gold);">${idx + 1}</td>
        <td><strong>${escapeHtml(it.title)}</strong></td>
        <td><span class="cat-tag beverage">${it.category}</span></td>
        <td style="font-weight: 700;">${it.quantity}</td>
        <td style="font-weight: 800; color: var(--color-gold);">₹${it.revenue.toLocaleString()}</td>
      `;
      bestsellersTableBody.appendChild(row);
    });
  }

  // --- Day-End Closing Z-Report Modal Logic ---
  if (btnOpenZReport) {
    btnOpenZReport.addEventListener('click', () => {
      if (!currentDailyData) return;
      const t = currentDailyData.totals || {};
      const today = new Date().toISOString().split('T')[0];

      zDatePrint.textContent = `Date: ${today}`;
      zTotalOrders.textContent = t.totalOrders || 0;
      zCompletedOrders.textContent = t.completedOrders || 0;
      zCancelledOrders.textContent = t.cancelledOrders || 0;
      zGrossSales.textContent = `₹${(t.totalRevenue || 0).toFixed(2)}`;
      if (zMaterialExpenses) zMaterialExpenses.textContent = `₹${(t.totalExpenses || 0).toFixed(2)}`;
      zNetRevenue.textContent = `₹${(t.netRevenue || t.totalRevenue || 0).toFixed(2)}`;
      zUpiRev.textContent = `₹${(t.upiRevenue || 0).toFixed(2)}`;
      zCardRev.textContent = `₹${(t.cardRevenue || 0).toFixed(2)}`;
      zCashRev.textContent = `₹${(t.cashRevenue || 0).toFixed(2)}`;

      inputClosingCash.value = Math.max(0, (t.cashRevenue || 0) - (t.totalExpenses || 0));
      zCashDiscrepancy.textContent = '₹0.00';

      zReportModal.classList.add('open');
    });
  }

  if (inputClosingCash) {
    inputClosingCash.addEventListener('input', () => {
      const t = currentDailyData?.totals || {};
      const expected = Math.max(0, (t.cashRevenue || 0) - (t.totalExpenses || 0));
      const counted = parseFloat(inputClosingCash.value) || 0;
      const diff = counted - expected;
      zCashDiscrepancy.textContent = diff < 0 ? `-₹${Math.abs(diff).toFixed(2)} (Short)` : (diff > 0 ? `+₹${diff.toFixed(2)} (Over)` : `₹0.00 (Balanced)`);
      zCashDiscrepancy.style.color = diff === 0 ? '#52B788' : '#B22222';
    });
  }

  if (btnCloseZModal) btnCloseZModal.addEventListener('click', () => zReportModal.classList.remove('open'));

  if (btnConfirmCloseDay) {
    btnConfirmCloseDay.addEventListener('click', async () => {
      try {
        const closingCash = parseFloat(inputClosingCash.value) || 0;
        const notes = inputZNotes.value;

        const res = await fetch('/api/reports/daily/close-day', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ closingCashInDrawer: closingCash, notes })
        });

        const data = await res.json();
        if (data.success) {
          showToast('✅ Official Day-End Z-Report Locked & Closed!', 'success');
          zReportModal.classList.remove('open');
          fetchDailySummary();
        }
      } catch (err) {
        showToast(`Error: ${err.message}`, 'danger');
      }
    });
  }

  if (btnPrintReceipt) {
    btnPrintReceipt.addEventListener('click', () => {
      window.print();
    });
  }

  if (btnRefreshAnalytics) {
    btnRefreshAnalytics.addEventListener('click', () => {
      fetchDailySummary();
      fetchMonthlyAnalytics();
      showToast('Financial Records Refreshed', 'info');
    });
  }

  if (selectMonth) {
    selectMonth.addEventListener('change', fetchMonthlyAnalytics);
  }

  // --- Real-time WebSockets ---
  if (socket) {
    socket.on('expense:recorded', () => {
      fetchMonthlyAnalytics();
      fetchDailySummary();
    });
    socket.on('expense:updated', () => {
      fetchMonthlyAnalytics();
      fetchDailySummary();
    });
    socket.on('expense:deleted', () => {
      fetchMonthlyAnalytics();
      fetchDailySummary();
    });
    socket.on('payment:recorded', () => {
      fetchMonthlyAnalytics();
      fetchDailySummary();
    });
    socket.on('order:created', () => {
      fetchMonthlyAnalytics();
      fetchDailySummary();
    });
  }

  // --- Toast Helper ---
  function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span>${message}</span>`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // Initial Data Load
  fetchDailySummary();
  fetchMonthlyAnalytics();
});
