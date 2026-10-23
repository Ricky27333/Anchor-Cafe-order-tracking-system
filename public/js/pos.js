/**
 * AnchorTrack 9-Tables POS & Fast Payment Terminal Logic
 * Optimized for Anchor Cafe (Ramapuram Beach, Chirala)
 * - 9 Fixed Tables Live Floor Tracking (Table 1 to Table 9)
 * - Itemized Table Order Breakdown (Item Name, Qty, Unit Cost, Line Total Cost)
 * - 1-Tap Payment Confirmation Ticks (PhonePe, GPay, Cash, Card) - Zero QR friction!
 * - Packaged Drinking Water, Soft Drinks & Energy Drinks tracking
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = typeof io !== 'undefined' ? io() : null;
  const soundEngine = window.soundEngine;

  // Sound toggle button
  const btnSoundToggle = document.getElementById('btnSoundToggle');
  if (btnSoundToggle) {
    btnSoundToggle.textContent = soundEngine.isMuted() ? '🔇 Sound: MUTED' : '🔊 Sound: ON';
    btnSoundToggle.addEventListener('click', () => {
      const isMuted = soundEngine.toggleMute();
      btnSoundToggle.textContent = isMuted ? '🔇 Sound: MUTED' : '🔊 Sound: ON';
      showToast(isMuted ? 'Audio alerts muted' : 'Audio alerts enabled', 'info');
    });
  }

  // --- State Variables ---
  let menuCatalog = [];
  let currentCategory = 'all';
  let searchQuery = '';
  let cart = [];
  let selectedTable = 'Table 1';
  let selectedPaymentMethod = 'PHONEPE';
  let modalSelectedPaymentMethod = 'PHONEPE';
  let tablesData = [];
  let activeTakeawaysData = [];
  let currentTotalTables = 9;
  let modalActiveOrder = null;
  let currentExpenseFilter = 'today';

  // DOM Elements - View Switchers & Capacity Controls
  const tabBtnMenuCatalog = document.getElementById('tabBtnMenuCatalog');
  const tabBtnTablesOverview = document.getElementById('tabBtnTablesOverview');
  const viewMenuCatalog = document.getElementById('viewMenuCatalog');
  const viewTablesGrid = document.getElementById('viewTablesGrid');
  const nineTablesGrid = document.getElementById('nineTablesGrid');
  const btnRefreshTables = document.getElementById('btnRefreshTables');
  const occupiedTablesCount = document.getElementById('occupiedTablesCount');
  const topActiveTableLabel = document.getElementById('topActiveTableLabel');
  const btnIncreaseTable = document.getElementById('btnIncreaseTable');
  const btnDecreaseTable = document.getElementById('btnDecreaseTable');
  const currentTableCountBadge = document.getElementById('currentTableCountBadge');
  const headerCapacityPill = document.getElementById('headerCapacityPill');
  const takeawaysGrid = document.getElementById('takeawaysGrid');
  const takeawaysCount = document.getElementById('takeawaysCount');
  const topTakeawaysCount = document.getElementById('topTakeawaysCount');
  const tablesGridOccupiedCount = document.getElementById('tablesGridOccupiedCount');

  // Daily Expenses DOM
  const btnOpenExpensesModal = document.getElementById('btnOpenExpensesModal');
  const expensesModal = document.getElementById('expensesModal');
  const btnCloseExpensesModal = document.getElementById('btnCloseExpensesModal');
  const btnCloseExpensesModalBtn = document.getElementById('btnCloseExpensesModalBtn');
  const topTodayExpensesPill = document.getElementById('topTodayExpensesPill');
  const expSummaryGross = document.getElementById('expSummaryGross');
  const expSummaryTotal = document.getElementById('expSummaryTotal');
  const expSummaryNet = document.getElementById('expSummaryNet');
  const expTitleInput = document.getElementById('expTitleInput');
  const expAmountInput = document.getElementById('expAmountInput');
  const expCategorySelect = document.getElementById('expCategorySelect');
  const expDeductionSelect = document.getElementById('expDeductionSelect');
  const expNotesInput = document.getElementById('expNotesInput');
  const btnSaveExpense = document.getElementById('btnSaveExpense');
  const expensesListContainer = document.getElementById('expensesListContainer');
  const expensesLogCount = document.getElementById('expensesLogCount');
  const btnFilterExpToday = document.getElementById('btnFilterExpToday');
  const btnFilterExpYesterday = document.getElementById('btnFilterExpYesterday');
  const btnFilterExpAll = document.getElementById('btnFilterExpAll');

  // Catalog DOM
  const itemsGrid = document.getElementById('itemsGrid');
  const catalogStats = document.getElementById('catalogStats');
  const searchInput = document.getElementById('searchInput');
  const categoryFilterBar = document.getElementById('categoryFilterBar');

  // Cart DOM
  const tablePillsRow = document.getElementById('tablePillsRow');
  const selectedTableDisplay = document.getElementById('selectedTableDisplay');
  const guestNameInput = document.getElementById('guestNameInput');
  const cartItemsList = document.getElementById('cartItemsList');
  const cartCount = document.getElementById('cartCount');
  const subtotalDisplay = document.getElementById('subtotalDisplay');
  const finalTotalDisplay = document.getElementById('finalTotalDisplay');
  const btnClearCart = document.getElementById('btnClearCart');
  const btnConfirmPaymentAndOrder = document.getElementById('btnConfirmPaymentAndOrder');
  const btnFireKotOnly = document.getElementById('btnFireKotOnly');
  const cartActiveTableNotice = document.getElementById('cartActiveTableNotice');
  const activeTableNoticeTitle = document.getElementById('activeTableNoticeTitle');
  const activeTableNoticeBill = document.getElementById('activeTableNoticeBill');
  const activeTableNoticeText = document.getElementById('activeTableNoticeText');

  // Table Detail Modal
  const tableDetailModal = document.getElementById('tableDetailModal');
  const modalTableTitle = document.getElementById('modalTableTitle');
  const modalTableOrderNum = document.getElementById('modalTableOrderNum');
  const modalTableItemsTbody = document.getElementById('modalTableItemsTbody');
  const modalTableTotalAmount = document.getElementById('modalTableTotalAmount');
  const btnCloseTableModal = document.getElementById('btnCloseTableModal');
  const btnModalAddMoreItems = document.getElementById('btnModalAddMoreItems');
  const btnModalSettlePayment = document.getElementById('btnModalSettlePayment');
  const modalPaymentTicks = document.getElementById('modalPaymentTicks');

  // Shake Variant Modal
  const shakeVariantModal = document.getElementById('shakeVariantModal');
  const variantsGrid = document.getElementById('variantsGrid');
  const variantModalTitle = document.getElementById('variantModalTitle');
  const btnCloseVariantModal = document.getElementById('btnCloseVariantModal');
  const btnCancelVariant = document.getElementById('btnCancelVariant');
  const btnConfirmVariant = document.getElementById('btnConfirmVariant');
  let activeShakeItem = null;
  let activeShakeVariant = null;

  // Edit Price / Cost Modal DOM
  const editPriceModal = document.getElementById('editPriceModal');
  const editPriceModalTitle = document.getElementById('editPriceModalTitle');
  const editPriceModalSubtitle = document.getElementById('editPriceModalSubtitle');
  const standardPriceInputGroup = document.getElementById('standardPriceInputGroup');
  const inputNewSellingPrice = document.getElementById('inputNewSellingPrice');
  const inputNewBaseCost = document.getElementById('inputNewBaseCost');
  const marginDisplay = document.getElementById('marginDisplay');
  const variantPriceInputsGroup = document.getElementById('variantPriceInputsGroup');
  const inputVarMilkPrice = document.getElementById('inputVarMilkPrice');
  const inputVarMilkCost = document.getElementById('inputVarMilkCost');
  const inputVarBlendPrice = document.getElementById('inputVarBlendPrice');
  const inputVarBlendCost = document.getElementById('inputVarBlendCost');
  const inputVarThickPrice = document.getElementById('inputVarThickPrice');
  const inputVarThickCost = document.getElementById('inputVarThickCost');
  const btnCloseEditPriceModal = document.getElementById('btnCloseEditPriceModal');
  const btnCancelEditPrice = document.getElementById('btnCancelEditPrice');
  const btnSaveUpdatedPrice = document.getElementById('btnSaveUpdatedPrice');
  const btnModalPrintBill = document.getElementById('btnModalPrintBill');
  const printableBillReceipt = document.getElementById('printableBillReceipt');
  let itemToEdit = null;

  function updateMarginDisplay() {
    if (!inputNewSellingPrice || !inputNewBaseCost || !marginDisplay) return;
    const sell = Number(inputNewSellingPrice.value) || 0;
    const cost = Number(inputNewBaseCost.value) || 0;
    const profit = sell - cost;
    const pct = sell > 0 ? Math.round((profit / sell) * 100) : 0;
    marginDisplay.textContent = `₹${profit} (${pct}% profit)`;
    marginDisplay.style.color = profit >= 0 ? '#52B788' : '#E63946';
  }

  if (inputNewSellingPrice) inputNewSellingPrice.addEventListener('input', updateMarginDisplay);
  if (inputNewBaseCost) inputNewBaseCost.addEventListener('input', updateMarginDisplay);

  // --- Fetch Master Menu Catalog ---
  async function fetchMenuCatalog() {
    try {
      catalogStats.textContent = 'Fetching Anchor Cafe offerings...';
      const response = await fetch('/api/menu');
      const data = await response.json();

      if (data.success && data.items) {
        menuCatalog = data.items;
        catalogStats.textContent = `${menuCatalog.length} coastal offerings loaded`;
        renderItems();
      } else {
        catalogStats.textContent = 'Failed to load menu';
      }
    } catch (err) {
      console.error('Menu load error:', err);
      catalogStats.textContent = 'Connecting to local database...';
    }
  }

  // --- Fetch Tables Live Status & Takeaways ---
  async function fetchTablesOverview() {
    try {
      const res = await fetch('/api/orders/tables');
      const data = await res.json();
      if (data.success) {
        tablesData = data.tables || [];
        activeTakeawaysData = data.activeTakeaways || [];
        currentTotalTables = data.totalTables || tablesData.length || 9;

        if (currentTableCountBadge) currentTableCountBadge.textContent = `${currentTotalTables} Tables`;
        if (headerCapacityPill) headerCapacityPill.textContent = `${currentTotalTables} Tables Active`;

        renderTablePills();
        renderTablesFloorGrid();
        renderTakeawaysFloorGrid();
        updateActiveTableNotice();
        renderCart();
      }
    } catch (err) {
      console.error('Tables fetch error:', err);
    }
  }

  // --- Render Dynamic Table Pills on Cart Side ---
  function renderTablePills() {
    tablePillsRow.innerHTML = '';
    for (let i = 1; i <= currentTotalTables; i++) {
      const tName = `Table ${i}`;
      const btn = document.createElement('button');
      btn.className = `table-pill ${selectedTable === tName ? 'active' : ''}`;
      btn.setAttribute('data-table', tName);
      btn.textContent = `T${i}`;

      const matched = tablesData.find(t => t.tableNumber === tName);
      if (matched && matched.isOccupied) {
        btn.classList.add('occupied');
      }
      tablePillsRow.appendChild(btn);
    }

    // Append Takeaway pill
    const takeawayBtn = document.createElement('button');
    takeawayBtn.className = `table-pill ${selectedTable === 'Takeaway' ? 'active' : ''}`;
    takeawayBtn.setAttribute('data-table', 'Takeaway');
    takeawayBtn.textContent = '🛍️ Takeaway';
    if (activeTakeawaysData.length > 0) {
      takeawayBtn.classList.add('occupied');
    }
    tablePillsRow.appendChild(takeawayBtn);
  }

  // --- Render Tables Floor Layout ---
  function renderTablesFloorGrid() {
    nineTablesGrid.innerHTML = '';
    let occupiedCount = 0;

    tablesData.forEach(tbl => {
      if (tbl.isOccupied) occupiedCount++;

      const card = document.createElement('div');
      card.className = `table-floor-card ${tbl.isOccupied ? 'occupied' : 'vacant'}`;

      let itemsSummaryHtml = 'Ready for dining guests';
      let billHtml = '₹0';

      if (tbl.isOccupied && tbl.order) {
        billHtml = `₹${tbl.order.finalTotalAmount}`;
        const itemNames = tbl.order.items.map(it => `${it.quantity}x ${it.title}`).join(', ');
        itemsSummaryHtml = `${tbl.order.totalItemCount} items: ${itemNames}`;
      }

      card.innerHTML = `
        <div class="table-card-top">
          <span class="table-card-name">${tbl.tableNumber}</span>
          <span class="table-status-indicator ${tbl.isOccupied ? 'occupied' : 'vacant'}">
            ${tbl.isOccupied ? '🔴 Active Bill' : '🟢 Available'}
          </span>
        </div>
        <div class="table-card-body">
          <div class="table-bill-amount">${billHtml}</div>
          <div class="table-items-preview">${itemsSummaryHtml}</div>
        </div>
        <div style="font-size: 0.75rem; color: var(--color-gold); font-weight: 600; display: flex; justify-content: space-between;">
          <span>${tbl.isOccupied ? `Order: ${tbl.order.orderNumber}` : 'Tap to start order'}</span>
          <span>&rarr;</span>
        </div>
      `;

      card.addEventListener('click', () => {
        handleTableClick(tbl);
      });

      nineTablesGrid.appendChild(card);
    });

    if (occupiedTablesCount) occupiedTablesCount.textContent = occupiedCount;
    if (tablesGridOccupiedCount) tablesGridOccupiedCount.textContent = occupiedCount;
  }

  // --- Render Active Takeaway Orders Section ---
  function renderTakeawaysFloorGrid() {
    if (!takeawaysGrid) return;
    takeawaysGrid.innerHTML = '';
    const count = activeTakeawaysData.length;
    if (takeawaysCount) takeawaysCount.textContent = count;
    if (topTakeawaysCount) topTakeawaysCount.textContent = count;

    if (count === 0) {
      takeawaysGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 1.25rem; text-align: center; color: var(--color-foam); opacity: 0.75; font-size: 0.85rem; border: 1px dashed rgba(72, 202, 228, 0.3); border-radius: var(--radius-sm);">
          🛍️ No active takeaway orders right now. Orders placed with "Takeaway" will appear here for packing &amp; handover.
        </div>
      `;
      return;
    }

    activeTakeawaysData.forEach(order => {
      const card = document.createElement('div');
      card.className = 'table-floor-card occupied';
      card.style.borderLeft = '4px solid #48CAE4';
      card.style.background = 'rgba(6, 24, 44, 0.85)';

      const itemNames = order.items.map(it => `${it.quantity}x ${it.title}`).join(', ');
      const guestName = order.locationDetails?.customerName || 'Takeaway Guest';

      card.innerHTML = `
        <div class="table-card-top">
          <span class="table-card-name" style="color: #48CAE4;">🛍️ ${order.orderNumber}</span>
          <span class="table-status-indicator occupied">
            ${order.paymentStatus === 'PAID' ? '🟢 Paid / Ready' : '🔴 Unpaid Parcel'}
          </span>
        </div>
        <div class="table-card-body">
          <div style="font-weight: 700; color: var(--color-sand); font-size: 0.9rem; margin-bottom: 0.25rem;">
            👤 ${guestName}
          </div>
          <div class="table-bill-amount">₹${order.finalTotalAmount}</div>
          <div class="table-items-preview">${order.totalItemCount} items: ${itemNames}</div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.5rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.4rem;">
          <small style="color: var(--color-sand-muted); font-size: 0.7rem;">Placed: ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
          <span style="color: var(--color-gold); font-size: 0.75rem; font-weight: 700;">View &amp; Settle &rarr;</span>
        </div>
      `;

      card.addEventListener('click', () => {
        openTableDetailModal(`Takeaway: ${order.orderNumber}`, order);
      });

      takeawaysGrid.appendChild(card);
    });
  }

  // Update pills on the cart side
  function updateTablePillsOccupancy() {
    document.querySelectorAll('.table-pill').forEach(btn => {
      const tName = btn.getAttribute('data-table');
      const matched = tablesData.find(t => t.tableNumber === tName);
      if (matched && matched.isOccupied) {
        btn.classList.add('occupied');
      } else {
        btn.classList.remove('occupied');
      }
    });
  }

  // --- Handle Click on a Table Card ---
  function handleTableClick(tbl) {
    selectTable(tbl.tableNumber);

    if (tbl.isOccupied && tbl.order) {
      // Open Table Running Bill Modal
      openTableDetailModal(tbl.tableNumber, tbl.order);
    } else {
      // Switch back to catalog view to add items
      switchView('catalog');
      showToast(`Selected ${tbl.tableNumber} for new order`, 'info');
    }
  }

  // Open Live Table Detail Modal
  function openTableDetailModal(tableName, order) {
    modalActiveOrder = order;
    modalTableTitle.textContent = `${tableName} Active Order`;
    modalTableOrderNum.textContent = `Order Ticket: ${order.orderNumber} • Placed ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    modalTableTotalAmount.textContent = `₹${order.finalTotalAmount}`;

    modalTableItemsTbody.innerHTML = '';
    order.items.forEach(it => {
      const tr = document.createElement('tr');
      tr.style.borderBottom = '1px dashed rgba(201, 168, 106, 0.15)';
      tr.innerHTML = `
        <td style="padding: 0.5rem 0; font-weight: 700; color: var(--color-gold);">${it.quantity}x</td>
        <td style="padding: 0.5rem 0;">
          <strong>${it.title}</strong>
          ${it.variant ? `<div style="font-size: 0.75rem; color: var(--color-gold);">${it.variant}</div>` : ''}
        </td>
        <td style="padding: 0.5rem 0; text-align: right; color: var(--color-foam); opacity: 0.85;">₹${it.unitPrice}</td>
        <td style="padding: 0.5rem 0; text-align: right; font-weight: 700; color: var(--color-gold);">₹${it.subtotal}</td>
      `;
      modalTableItemsTbody.appendChild(tr);
    });

    tableDetailModal.classList.add('open');
  }

  if (btnCloseTableModal) {
    btnCloseTableModal.addEventListener('click', () => {
      if (tableDetailModal) tableDetailModal.classList.remove('open');
      modalActiveOrder = null;
    });
  }

  // Modal: Add more items to table
  if (btnModalAddMoreItems) {
    btnModalAddMoreItems.addEventListener('click', () => {
      const targetTbl = (modalActiveOrder && modalActiveOrder.locationDetails && modalActiveOrder.locationDetails.tableNumber) 
        ? modalActiveOrder.locationDetails.tableNumber 
        : selectedTable;
      selectTable(targetTbl);
      if (tableDetailModal) tableDetailModal.classList.remove('open');
      modalActiveOrder = null;
      switchView('catalog');
      showToast(`Selected ${selectedTable}! Tap any water bottle, drink, or food item to add to running bill.`, 'success');
    });
  }

  // Thermal Receipt Printing for Tables
  function printOrderReceipt(order, tableName) {
    if (!order || !printableBillReceipt) return;

    const dateStr = new Date(order.createdAt || Date.now()).toLocaleString();
    let rowsHtml = '';
    (order.items || []).forEach(it => {
      const lineTot = it.subtotal || (it.unitPrice * it.quantity);
      rowsHtml += `
        <tr>
          <td>${it.quantity}x</td>
          <td>${it.title}${it.variant ? ` (${it.variant})` : ''}</td>
          <td style="text-align: right;">₹${it.unitPrice}</td>
          <td style="text-align: right;">₹${lineTot}</td>
        </tr>
      `;
    });

    printableBillReceipt.innerHTML = `
      <div class="receipt-header">
        <div class="receipt-title">⚓ ANCHOR CAFE ⚓</div>
        <div class="receipt-meta">Ramapuram Beach, Chirala (A.P.)</div>
        <div class="receipt-meta">Live Beach POS &amp; Order Terminal</div>
        <div class="receipt-meta" style="margin-top: 5px;"><strong>${tableName || order.locationDetails?.tableNumber || 'Beach Order'}</strong></div>
        <div class="receipt-meta">Order: ${order.orderNumber}</div>
        <div class="receipt-meta">${dateStr}</div>
      </div>
      <table class="receipt-table">
        <thead>
          <tr>
            <th>Qty</th>
            <th>Item</th>
            <th style="text-align: right;">Price</th>
            <th style="text-align: right;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="receipt-total-row">
        <span>TOTAL BILL AMOUNT</span>
        <span>₹${order.finalTotalAmount || order.subtotalAmount || 0}</span>
      </div>
      <div style="font-size: 11px; margin-top: 4px;">
        Payment: <strong>${order.paymentMethod || 'PHONEPE'}</strong> (${order.paymentStatus || 'UNPAID'})
      </div>
      <div class="receipt-footer">
        <div>Thank you for visiting Anchor Cafe!</div>
        <div>Experience the Ocean Waves &bull; Visit Again 🌊</div>
      </div>
    `;

    window.print();
  }

  if (btnModalPrintBill) {
    btnModalPrintBill.addEventListener('click', () => {
      if (modalActiveOrder) {
        printOrderReceipt(modalActiveOrder, selectedTable);
      }
    });
  }

  // Modal Payment Ticks
  if (modalPaymentTicks) {
    modalPaymentTicks.addEventListener('click', (e) => {
      const btn = e.target.closest('.pay-tick-btn');
      if (!btn) return;
      modalPaymentTicks.querySelectorAll('.pay-tick-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      modalSelectedPaymentMethod = btn.getAttribute('data-settle-method');
    });
  }

  // Modal: Confirm Payment & Free Table
  if (btnModalSettlePayment) {
    btnModalSettlePayment.addEventListener('click', async () => {
    if (!modalActiveOrder) return;
    try {
      btnModalSettlePayment.disabled = true;
      btnModalSettlePayment.textContent = 'Settling...';

      const res = await fetch('/api/orders/settle-table', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: modalActiveOrder._id,
          paymentMethod: modalSelectedPaymentMethod
        })
      });

      const data = await res.json();
      if (data.success) {
        soundEngine.playPaymentSuccess();
        showToast(`✅ ${selectedTable} settled via ${modalSelectedPaymentMethod}! Table is now FREE.`, 'success');
        tableDetailModal.classList.remove('open');
        modalActiveOrder = null;
        clearCart();
        fetchTablesOverview();
      } else {
        showToast(data.message || 'Error settling table', 'danger');
      }
    } catch (err) {
      showToast(err.message, 'danger');
    } finally {
      btnModalSettlePayment.disabled = false;
      btnModalSettlePayment.textContent = '✅ Confirm Paid & Free Table';
    }
  });
  }

  // --- View Switcher Logic ---
  function switchView(mode) {
    if (mode === 'catalog') {
      tabBtnMenuCatalog.classList.add('active');
      tabBtnTablesOverview.classList.remove('active');
      viewMenuCatalog.style.display = 'flex';
      viewTablesGrid.style.display = 'none';
    } else {
      tabBtnMenuCatalog.classList.remove('active');
      tabBtnTablesOverview.classList.add('active');
      viewMenuCatalog.style.display = 'none';
      viewTablesGrid.style.display = 'block';
      fetchTablesOverview();
    }
  }

  if (tabBtnMenuCatalog) tabBtnMenuCatalog.addEventListener('click', () => switchView('catalog'));
  if (tabBtnTablesOverview) tabBtnTablesOverview.addEventListener('click', () => switchView('tables'));
  if (btnRefreshTables) btnRefreshTables.addEventListener('click', fetchTablesOverview);

  // Table Capacity Increase / Decrease Handlers
  if (btnIncreaseTable) {
    btnIncreaseTable.addEventListener('click', async () => {
      try {
        btnIncreaseTable.disabled = true;
        const res = await fetch('/api/orders/tables/increase', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast(`✅ ${data.message}`, 'success');
          fetchTablesOverview();
        } else {
          showToast(data.message || 'Could not increase table count', 'danger');
        }
      } catch (err) {
        showToast(err.message, 'danger');
      } finally {
        btnIncreaseTable.disabled = false;
      }
    });
  }

  if (btnDecreaseTable) {
    btnDecreaseTable.addEventListener('click', async () => {
      try {
        btnDecreaseTable.disabled = true;
        const res = await fetch('/api/orders/tables/decrease', { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast(`✅ ${data.message}`, 'success');
          fetchTablesOverview();
        } else {
          showToast(data.message || 'Could not decrease table count', 'danger');
        }
      } catch (err) {
        showToast(err.message, 'danger');
      } finally {
        btnDecreaseTable.disabled = false;
      }
    });
  }

  // --- Daily Expenses & Petty Cash Functions ---
  async function fetchExpenseSummary() {
    try {
      const res = await fetch('/api/expenses/summary');
      const data = await res.json();
      if (data.success) {
        const todayExp = data.today.totalExpenses || 0;
        if (topTodayExpensesPill) topTodayExpensesPill.textContent = `₹${todayExp}`;
        if (expSummaryGross) expSummaryGross.textContent = `₹${data.today.grossSales || 0}`;
        if (expSummaryTotal) expSummaryTotal.textContent = `₹${todayExp}`;
        if (expSummaryNet) expSummaryNet.textContent = `₹${data.today.netSales || 0}`;
      }
    } catch (err) {
      console.error('Expense summary error:', err);
    }
  }

  async function fetchExpensesList(filter = 'today') {
    try {
      currentExpenseFilter = filter;
      const res = await fetch(`/api/expenses?filter=${filter}`);
      const data = await res.json();
      if (data.success) {
        renderExpensesList(data.expenses || []);
      }
    } catch (err) {
      console.error('Expenses list error:', err);
    }
  }

  function renderExpensesList(expenses) {
    if (!expensesListContainer) return;
    expensesListContainer.innerHTML = '';
    if (expensesLogCount) expensesLogCount.textContent = expenses.length;

    if (expenses.length === 0) {
      expensesListContainer.innerHTML = `
        <div style="text-align: center; padding: 1.5rem; color: var(--color-foam); opacity: 0.7; font-size: 0.85rem;">
          No requirements or expenses recorded for this period.
        </div>
      `;
      return;
    }

    expenses.forEach(exp => {
      const row = document.createElement('div');
      row.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: rgba(11, 37, 69, 0.7); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius-sm); padding: 0.6rem 0.8rem;';

      const sourceLabel = exp.deductedFrom === 'YESTERDAYS_SALES' ? "Yesterday's Sales" : (exp.deductedFrom === 'PETTY_CASH' ? 'Petty Cash' : "Today's Sales");
      const dateStr = new Date(exp.expenseDate).toLocaleDateString([], { month: 'short', day: 'numeric' }) + ' ' + new Date(exp.expenseDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      row.innerHTML = `
        <div>
          <div style="font-weight: 700; color: var(--color-sand); font-size: 0.85rem;">
            ${exp.title}
          </div>
          <div style="font-size: 0.72rem; color: var(--color-sand-muted); display: flex; gap: 0.4rem; align-items: center; margin-top: 0.15rem; flex-wrap: wrap;">
            <span style="background: rgba(201,168,106,0.15); color: var(--color-gold); padding: 0.1rem 0.35rem; border-radius: 3px;">${exp.category.replace('_', ' ')}</span>
            <span>&bull; Deducted: <strong style="color: #FFB4A2;">${sourceLabel}</strong></span>
            <span>&bull; ${dateStr}</span>
          </div>
          ${exp.notes ? `<small style="font-size: 0.7rem; color: var(--color-foam); opacity: 0.8; display: block;">Note: ${exp.notes}</small>` : ''}
        </div>
        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <div style="font-size: 1.05rem; font-weight: 800; color: #E63946;">-₹${exp.amount}</div>
          <button class="btn-outline btn-delete-expense" data-id="${exp._id}" style="padding: 0.2rem 0.45rem; font-size: 0.75rem; border-color: rgba(230,57,70,0.5); color: #E63946;" title="Void / Delete Expense">&times;</button>
        </div>
      `;

      row.querySelector('.btn-delete-expense').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm(`Void expense "${exp.title}" (₹${exp.amount})?`)) {
          await deleteExpense(exp._id);
        }
      });

      expensesListContainer.appendChild(row);
    });
  }

  async function deleteExpense(id) {
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast(data.message, 'success');
        fetchExpenseSummary();
        fetchExpensesList(currentExpenseFilter);
      } else {
        showToast(data.message || 'Failed to delete expense', 'danger');
      }
    } catch (err) {
      showToast(err.message, 'danger');
    }
  }

  if (btnOpenExpensesModal) {
    btnOpenExpensesModal.addEventListener('click', () => {
      expensesModal.classList.add('open');
      fetchExpenseSummary();
      fetchExpensesList('today');
    });
  }

  if (btnCloseExpensesModal) btnCloseExpensesModal.addEventListener('click', () => expensesModal.classList.remove('open'));
  if (btnCloseExpensesModalBtn) btnCloseExpensesModalBtn.addEventListener('click', () => expensesModal.classList.remove('open'));

  // Preset buttons handler
  document.querySelectorAll('.exp-preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (expTitleInput) expTitleInput.value = btn.getAttribute('data-preset-title');
      if (expCategorySelect) expCategorySelect.value = btn.getAttribute('data-preset-cat');
      if (expAmountInput) {
        expAmountInput.value = btn.getAttribute('data-preset-amt');
        expAmountInput.focus();
      }
    });
  });

  if (btnSaveExpense) {
    btnSaveExpense.addEventListener('click', async () => {
      const title = expTitleInput.value.trim();
      const amount = Number(expAmountInput.value);
      const category = expCategorySelect.value;
      const deductedFrom = expDeductionSelect.value;
      const notes = expNotesInput.value.trim();

      if (!title || !amount || amount <= 0) {
        showToast('Please enter requirement title and amount', 'warning');
        return;
      }

      try {
        btnSaveExpense.disabled = true;
        btnSaveExpense.textContent = 'Saving...';

        const res = await fetch('/api/expenses', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ title, amount, category, deductedFrom, notes })
        });

        const data = await res.json();
        if (data.success) {
          showToast(`✅ ${data.message}`, 'success');
          expTitleInput.value = '';
          expAmountInput.value = '';
          expNotesInput.value = '';
          fetchExpenseSummary();
          fetchExpensesList(currentExpenseFilter);
        } else {
          showToast(data.message || 'Error recording expense', 'danger');
        }
      } catch (err) {
        showToast(err.message, 'danger');
      } finally {
        btnSaveExpense.disabled = false;
        btnSaveExpense.textContent = '💾 Record & Deduct';
      }
    });
  }

  if (btnFilterExpToday) {
    btnFilterExpToday.addEventListener('click', () => {
      document.querySelectorAll('#btnFilterExpToday, #btnFilterExpYesterday, #btnFilterExpAll').forEach(b => b.classList.remove('active'));
      btnFilterExpToday.classList.add('active');
      fetchExpensesList('today');
    });
  }

  if (btnFilterExpYesterday) {
    btnFilterExpYesterday.addEventListener('click', () => {
      document.querySelectorAll('#btnFilterExpToday, #btnFilterExpYesterday, #btnFilterExpAll').forEach(b => b.classList.remove('active'));
      btnFilterExpYesterday.classList.add('active');
      fetchExpensesList('yesterday');
    });
  }

  if (btnFilterExpAll) {
    btnFilterExpAll.addEventListener('click', () => {
      document.querySelectorAll('#btnFilterExpToday, #btnFilterExpYesterday, #btnFilterExpAll').forEach(b => b.classList.remove('active'));
      btnFilterExpAll.classList.add('active');
      fetchExpensesList('all');
    });
  }

  // --- Helper to get active running order for current table ---
  function getActiveOrderForSelectedTable() {
    if (selectedTable === 'Takeaway') return null;
    const matched = tablesData.find(t => t.tableNumber === selectedTable);
    if (matched && matched.isOccupied && matched.order) {
      return matched.order;
    }
    return null;
  }

  function updateActiveTableNotice() {
    if (!cartActiveTableNotice) return;
    const activeOrder = getActiveOrderForSelectedTable();
    if (activeOrder) {
      cartActiveTableNotice.style.display = 'block';
      if (activeTableNoticeTitle) activeTableNoticeTitle.textContent = `🔔 ${selectedTable} Active Bill`;
      if (activeTableNoticeBill) activeTableNoticeBill.textContent = `₹${activeOrder.finalTotalAmount} (${activeOrder.totalItemCount} items)`;
      if (activeTableNoticeText) {
        activeTableNoticeText.textContent = `Guests dining. New items (water bottles, drinks, food) added below will automatically append to this table's running bill!`;
      }
      if (guestNameInput && (!guestNameInput.value || guestNameInput.value === 'Guest')) {
        guestNameInput.value = activeOrder.locationDetails?.customerName || 'Guest';
      }
    } else {
      cartActiveTableNotice.style.display = 'none';
    }
  }

  // --- Select Table Pill in Cart ---
  function selectTable(tableName) {
    selectedTable = tableName;
    selectedTableDisplay.value = tableName;
    topActiveTableLabel.textContent = tableName;

    document.querySelectorAll('.table-pill').forEach(btn => {
      if (btn.getAttribute('data-table') === tableName) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    updateActiveTableNotice();
    renderCart();
  }

  tablePillsRow.addEventListener('click', (e) => {
    const btn = e.target.closest('.table-pill');
    if (!btn) return;
    const tName = btn.getAttribute('data-table');
    selectTable(tName);

    if (tName === 'Takeaway') {
      if (activeTakeawaysData.length > 0) {
        showToast(`${activeTakeawaysData.length} active takeaway orders in progress`, 'info');
      }
      return;
    }

    // If occupied, notify cashier that items will be added to this active bill
    const matched = tablesData.find(t => t.tableNumber === tName);
    if (matched && matched.isOccupied && matched.order) {
      showToast(`Selected ${tName} (Running: ₹${matched.order.finalTotalAmount}). Tap water bottle, drinks, or items to add to bill!`, 'info');
    }
  });

  // --- Render Menu Items ---
  function renderItems() {
    itemsGrid.innerHTML = '';

    const filtered = menuCatalog.filter(item => {
      const matchesCategory = currentCategory === 'all' || item.category === currentCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q ||
        item.title.toLowerCase().includes(q) ||
        item.sku.toLowerCase().includes(q) ||
        (item.description && item.description.toLowerCase().includes(q)) ||
        (item.tags && item.tags.some(t => t.toLowerCase().includes(q)));
      return matchesCategory && matchesSearch;
    });

    const categoryOrder = [
      'soft-drinks',
      'energy-drinks',
      'hot-beverages',
      'shakes',
      'mojitos',
      'snacks',
      'icecream',
      'beach-services'
    ];

    filtered.sort((a, b) => {
      const catA = categoryOrder.indexOf(a.category);
      const catB = categoryOrder.indexOf(b.category);
      const orderA = catA === -1 ? 99 : catA;
      const orderB = catB === -1 ? 99 : catB;
      if (orderA !== orderB) return orderA - orderB;
      return (a.sku || '').localeCompare(b.sku || '');
    });

    if (filtered.length === 0) {
      itemsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--color-foam); opacity: 0.7;">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🌊</div>
          <p>No offerings found matching "${searchQuery}"</p>
        </div>
      `;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'menu-card';
      card.setAttribute('data-id', item._id);

      // Determine badge
      let badgeClass = 'veg';
      let badgeLabel = 'Veg';
      if (item.category === 'soft-drinks') {
        badgeClass = 'veg';
        badgeLabel = item.title.includes('Water') ? 'Water' : 'Soft Drink';
      } else if (item.category === 'energy-drinks') {
        badgeClass = 'non-veg';
        badgeLabel = 'Energy';
      } else if (item.tags && item.tags.includes('Non-Veg')) {
        badgeClass = 'non-veg';
        badgeLabel = 'Non-Veg';
      } else if (item.category === 'beach-services') {
        badgeClass = 'experience';
        badgeLabel = 'Experience';
      }

      // Price rendering with direct clickable edit
      let priceHtml = '';
      if (item.hasVariants) {
        const minPrice = Math.min(...item.variants.map(v => v.sellingPrice));
        priceHtml = `
          <div class="card-price-container btn-edit-price" data-id="${item._id}" title="Click to modify cost/price for ${item.title}">
            <span style="font-size: 0.68rem; color: var(--color-sand-muted); display: block;">From</span>
            <div style="display: flex; align-items: baseline; gap: 0.35rem;">
              <span class="charm-price">₹${minPrice}</span>
              <span class="price-modify-hint">✏️ Cost</span>
            </div>
          </div>
        `;
      } else {
        priceHtml = `
          <div class="card-price-container btn-edit-price" data-id="${item._id}" title="Click to modify cost/price for ${item.title}">
            <div style="display: flex; align-items: baseline; gap: 0.35rem;">
              <span class="charm-price">₹${item.sellingPrice}</span>
              ${item.isMrp ? '<span class="price-tag-rule">MRP</span>' : (item.category === 'hot-beverages' ? '<span class="price-tag-rule">Authentic</span>' : '<span class="price-tag-rule">Price</span>')}
            </div>
            <span class="price-modify-hint">✏️ Modify Cost</span>
          </div>
        `;
      }

      card.innerHTML = `
        <div class="card-top">
          <span class="card-sku">${item.sku}</span>
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <button class="btn-edit-price" data-id="${item._id}" title="Edit Cost / Price for ${item.title}">✏️ Edit</button>
            <span class="card-badge ${badgeClass}">${badgeLabel}</span>
          </div>
        </div>
        <h3 class="card-title">${item.title}</h3>
        <p class="card-desc">${item.servingSize ? `<strong>${item.servingSize}</strong> &bull; ` : ''}${item.description || ''}</p>
        <div class="card-bottom">
          ${priceHtml}
          <button class="btn-add-item" title="Add to Table Order">${item.hasVariants ? '⚡' : '+'}</button>
        </div>
      `;

      // Both top edit button and bottom price tag open the cost modification modal
      card.querySelectorAll('.btn-edit-price').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditPriceModal(item);
        });
      });

      // ONLY clicking the plus button adds the item to the order (not anywhere on card)
      const btnAdd = card.querySelector('.btn-add-item');
      if (btnAdd) {
        btnAdd.addEventListener('click', (e) => {
          e.stopPropagation();
          handleItemSelect(item);
        });
      }

      itemsGrid.appendChild(card);
    });
  }

  // --- Handle Item Select ---
  function handleItemSelect(item) {
    if (item.hasVariants && item.variants && item.variants.length > 0) {
      openShakeVariantModal(item);
    } else {
      addToCart({
        menuItemId: item._id,
        sku: item.sku,
        title: item.title,
        category: item.category,
        variant: null,
        unitPrice: item.sellingPrice,
        baseCost: item.baseCost
      });
    }
  }

  // --- Shake Variant Modal Logic ---
  function openShakeVariantModal(shakeItem) {
    activeShakeItem = shakeItem;
    activeShakeVariant = shakeItem.variants[2] || shakeItem.variants[0];
    variantModalTitle.textContent = `${shakeItem.title}`;

    variantsGrid.innerHTML = '';
    shakeItem.variants.forEach(variant => {
      const card = document.createElement('div');
      card.className = `variant-card ${variant.variantName === activeShakeVariant.variantName ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="variant-name">${variant.variantName}</div>
        <div class="variant-price">₹${variant.sellingPrice}</div>
        <small style="font-size: 0.68rem; color: var(--color-foam); opacity: 0.8;">
          ${variant.variantName === 'Thickshake' ? 'Ultra-dense Spoonable' : (variant.variantName === 'Blended' ? 'Creamy Soft Serve' : 'Light & Chilled')}
        </small>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.variant-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        activeShakeVariant = variant;
      });

      variantsGrid.appendChild(card);
    });

    shakeVariantModal.classList.add('open');
  }

  function closeShakeVariantModal() {
    shakeVariantModal.classList.remove('open');
    activeShakeItem = null;
    activeShakeVariant = null;
  }

  if (btnConfirmVariant) {
    btnConfirmVariant.addEventListener('click', () => {
      if (!activeShakeItem || !activeShakeVariant) return;
      addToCart({
        menuItemId: activeShakeItem._id,
        sku: activeShakeItem.sku,
        title: activeShakeItem.title,
        category: activeShakeItem.category,
        variant: activeShakeVariant.variantName,
        unitPrice: activeShakeVariant.sellingPrice,
        baseCost: activeShakeVariant.baseCost
      });
      closeShakeVariantModal();
    });
  }

  if (btnCloseVariantModal) btnCloseVariantModal.addEventListener('click', closeShakeVariantModal);
  if (btnCancelVariant) btnCancelVariant.addEventListener('click', closeShakeVariantModal);

  // --- Edit Price / Cost Modal Logic ---
  function openEditPriceModal(item) {
    itemToEdit = item;
    editPriceModalTitle.textContent = `✏️ Modify Cost & Price: ${item.title}`;
    editPriceModalSubtitle.textContent = `Update customer selling price and cafe procurement cost for ${item.title} (${item.sku}). Saved permanently to database.`;

    if (item.hasVariants && item.variants && item.variants.length > 0) {
      standardPriceInputGroup.style.display = 'none';
      variantPriceInputsGroup.style.display = 'flex';

      const milk = item.variants.find(v => v.variantName === 'Milkshake');
      const blend = item.variants.find(v => v.variantName === 'Blended');
      const thick = item.variants.find(v => v.variantName === 'Thickshake');

      if (inputVarMilkPrice) inputVarMilkPrice.value = milk ? milk.sellingPrice : '';
      if (inputVarMilkCost) inputVarMilkCost.value = milk ? (milk.baseCost || milk.sellingPrice) : '';

      if (inputVarBlendPrice) inputVarBlendPrice.value = blend ? blend.sellingPrice : '';
      if (inputVarBlendCost) inputVarBlendCost.value = blend ? (blend.baseCost || blend.sellingPrice) : '';

      if (inputVarThickPrice) inputVarThickPrice.value = thick ? thick.sellingPrice : '';
      if (inputVarThickCost) inputVarThickCost.value = thick ? (thick.baseCost || thick.sellingPrice) : '';
    } else {
      standardPriceInputGroup.style.display = 'block';
      variantPriceInputsGroup.style.display = 'none';
      if (inputNewSellingPrice) inputNewSellingPrice.value = item.sellingPrice;
      if (inputNewBaseCost) inputNewBaseCost.value = item.baseCost !== undefined ? item.baseCost : item.sellingPrice;
      updateMarginDisplay();
      setTimeout(() => inputNewSellingPrice && inputNewSellingPrice.focus(), 150);
    }

    editPriceModal.classList.add('open');
  }

  function closeEditPriceModal() {
    editPriceModal.classList.remove('open');
    itemToEdit = null;
  }

  if (btnCloseEditPriceModal) btnCloseEditPriceModal.addEventListener('click', closeEditPriceModal);
  if (btnCancelEditPrice) btnCancelEditPrice.addEventListener('click', closeEditPriceModal);

  if (btnSaveUpdatedPrice) {
    btnSaveUpdatedPrice.addEventListener('click', async () => {
    if (!itemToEdit) return;

    try {
      btnSaveUpdatedPrice.disabled = true;
      btnSaveUpdatedPrice.textContent = '💾 Saving...';

      let payload = {};
      if (itemToEdit.hasVariants) {
        payload.variants = [
          { 
            variantName: 'Milkshake', 
            sellingPrice: Number(inputVarMilkPrice.value),
            baseCost: inputVarMilkCost ? Number(inputVarMilkCost.value) : Number(inputVarMilkPrice.value)
          },
          { 
            variantName: 'Blended', 
            sellingPrice: Number(inputVarBlendPrice.value),
            baseCost: inputVarBlendCost ? Number(inputVarBlendCost.value) : Number(inputVarBlendPrice.value)
          },
          { 
            variantName: 'Thickshake', 
            sellingPrice: Number(inputVarThickPrice.value),
            baseCost: inputVarThickCost ? Number(inputVarThickCost.value) : Number(inputVarThickPrice.value)
          }
        ];
      } else {
        const newPrice = Number(inputNewSellingPrice.value);
        const newCost = inputNewBaseCost ? Number(inputNewBaseCost.value) : newPrice;
        if (isNaN(newPrice) || newPrice < 0) {
          showToast('Please enter a valid price amount', 'warning');
          btnSaveUpdatedPrice.disabled = false;
          btnSaveUpdatedPrice.textContent = '💾 Save Updated Cost & Price';
          return;
        }
        payload.sellingPrice = newPrice;
        payload.baseCost = isNaN(newCost) ? newPrice : newCost;
      }

      const res = await fetch(`/api/menu/${itemToEdit._id}/price`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success && data.item) {
        const idx = menuCatalog.findIndex(m => m._id === data.item._id);
        if (idx !== -1) {
          menuCatalog[idx] = data.item;
        }
        renderItems();
        closeEditPriceModal();
        showToast(`✅ Cost & Price for "${data.item.title}" updated permanently to ₹${data.item.sellingPrice}!`, 'success');
      } else {
        showToast(data.message || 'Failed to update cost/price', 'danger');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'danger');
    } finally {
      btnSaveUpdatedPrice.disabled = false;
      btnSaveUpdatedPrice.textContent = '💾 Save Updated Cost & Price';
    }
  });
  }

  // --- Cart Management ---
  function addToCart(item) {
    const existingIndex = cart.findIndex(c =>
      c.title === item.title && c.variant === item.variant
    );

    if (existingIndex > -1) {
      cart[existingIndex].quantity += 1;
    } else {
      cart.push({
        ...item,
        quantity: 1
      });
    }

    renderCart();
    showToast(`Added ${item.title} to ${selectedTable}`, 'success');
  }

  function changeQty(index, delta) {
    if (cart[index]) {
      cart[index].quantity += delta;
      if (cart[index].quantity <= 0) {
        cart.splice(index, 1);
      }
      renderCart();
    }
  }

  function clearCart() {
    cart = [];
    renderCart();
  }

  function calculateCartTotals() {
    let subtotal = 0;
    let totalItems = 0;
    cart.forEach(it => {
      subtotal += it.unitPrice * it.quantity;
      totalItems += it.quantity;
    });
    return { subtotal, totalItems };
  }

  function renderCart() {
    const { subtotal, totalItems } = calculateCartTotals();
    const activeOrder = getActiveOrderForSelectedTable();

    cartCount.textContent = totalItems;

    if (activeOrder) {
      const runningBill = Number(activeOrder.finalTotalAmount) || 0;
      const combinedTotal = runningBill + subtotal;

      if (subtotal > 0) {
        subtotalDisplay.textContent = `+₹${subtotal} (New Items)`;
        finalTotalDisplay.textContent = `₹${combinedTotal} (Updated Total)`;
        if (btnFireKotOnly) btnFireKotOnly.textContent = `🔥 Add to ${selectedTable} (KOT)`;
        if (btnConfirmPaymentAndOrder) btnConfirmPaymentAndOrder.textContent = `💳 Settle Full Bill (₹${combinedTotal})`;
      } else {
        subtotalDisplay.textContent = `₹0`;
        finalTotalDisplay.textContent = `₹${runningBill} (Current Bill)`;
        if (btnFireKotOnly) btnFireKotOnly.textContent = `🔥 Fire KOT (Table Tab)`;
        if (btnConfirmPaymentAndOrder) btnConfirmPaymentAndOrder.textContent = `1-Tap: Confirm & Settle`;
      }
    } else {
      subtotalDisplay.textContent = `₹${subtotal}`;
      finalTotalDisplay.textContent = `₹${subtotal}`;
      if (btnFireKotOnly) btnFireKotOnly.textContent = `🔥 Fire KOT (Table Tab)`;
      if (btnConfirmPaymentAndOrder) btnConfirmPaymentAndOrder.textContent = `1-Tap: Confirm & Settle`;
    }

    // Update mobile floating bar & top mobile badge
    const mobileCartTableLabel = document.getElementById('mobileCartTableLabel');
    const mobileCartCount = document.getElementById('mobileCartCount');
    const mobileCartTotal = document.getElementById('mobileCartTotal');
    const topCartBadgeCount = document.getElementById('topCartBadgeCount');
    const topCartBadgeTotal = document.getElementById('topCartBadgeTotal');
    if (mobileCartTableLabel) mobileCartTableLabel.textContent = selectedTable;
    if (mobileCartCount) mobileCartCount.textContent = totalItems;
    if (mobileCartTotal) mobileCartTotal.textContent = `₹${subtotal}`;
    if (topCartBadgeCount) topCartBadgeCount.textContent = totalItems;
    if (topCartBadgeTotal) topCartBadgeTotal.textContent = `₹${subtotal}`;

    if (cart.length === 0) {
      cartItemsList.innerHTML = `
        <div class="cart-empty-state">
          <div class="empty-icon">☕</div>
          <p>${selectedTable} order is empty</p>
          <small>Tap water bottle, soft drinks, coffee, or snacks to add</small>
        </div>
      `;
      return;
    }

    cartItemsList.innerHTML = '';
    cart.forEach((item, idx) => {
      const row = document.createElement('div');
      row.className = 'cart-item-row';
      row.innerHTML = `
        <div class="item-info-col">
          <div class="item-info-title">${item.title}</div>
          ${item.variant ? `<div class="item-info-variant">${item.variant}</div>` : ''}
          <div class="item-info-price">₹${item.unitPrice} each</div>
        </div>
        <div class="qty-controls">
          <button class="btn-qty" data-idx="${idx}" data-delta="-1">-</button>
          <span class="qty-num">${item.quantity}</span>
          <button class="btn-qty" data-idx="${idx}" data-delta="1">+</button>
        </div>
        <div class="item-subtotal">₹${item.unitPrice * item.quantity}</div>
      `;

      row.querySelectorAll('.btn-qty').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const i = parseInt(btn.getAttribute('data-idx'), 10);
          const d = parseInt(btn.getAttribute('data-delta'), 10);
          changeQty(i, d);
        });
      });

      cartItemsList.appendChild(row);
    });
  }

  if (btnClearCart) btnClearCart.addEventListener('click', clearCart);

  // --- Payment Ticks in Cart Panel ---
  document.querySelectorAll('.payment-ticks-row .pay-tick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.payment-ticks-row .pay-tick-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPaymentMethod = btn.getAttribute('data-method');
    });
  });

  // --- Category Filter Tabs ---
  if (categoryFilterBar) {
    categoryFilterBar.addEventListener('click', (e) => {
      const target = e.target.closest('.cat-pill');
      if (!target) return;
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      target.classList.add('active');
      currentCategory = target.getAttribute('data-cat');
      renderItems();
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderItems();
    });
  }

  // --- Create / Fire Order ---
  async function submitTableOrder(isPaidImmediately = false) {
    if (cart.length === 0) {
      showToast('Please add items to cart first', 'warning');
      return;
    }

    try {
      const orderType = selectedTable === 'Takeaway' ? 'TAKEAWAY' : 'DINE_IN';
      const payload = {
        orderType,
        locationDetails: {
          tableNumber: selectedTable,
          customerName: guestNameInput.value || 'Guest'
        },
        items: cart.map(it => ({
          menuItemId: it.menuItemId,
          sku: it.sku,
          title: it.title,
          category: it.category,
          variant: it.variant,
          unitPrice: it.unitPrice,
          quantity: it.quantity
        })),
        paymentMethod: selectedPaymentMethod,
        paymentStatus: isPaidImmediately ? 'PAID' : 'UNPAID',
        appendToExisting: true // Appends to running table bill if table is already active
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (data.success) {
        if (isPaidImmediately) {
          soundEngine.playPaymentSuccess();
          showToast(`✅ Payment confirmed via ${selectedPaymentMethod} for ${selectedTable}! KOT sent.`, 'success');
        } else {
          soundEngine.playNewOrderChime();
          showToast(`🔥 Order placed for ${selectedTable} (${data.order.orderNumber})! Pay later tab opened.`, 'success');
        }

        clearCart();
        closeMobileCart();
        fetchTablesOverview();
      } else {
        showToast(data.message || 'Order failed', 'danger');
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'danger');
    }
  }

  // 1-Tap: Confirm Payment & Fire KOT
  if (btnConfirmPaymentAndOrder) {
    btnConfirmPaymentAndOrder.addEventListener('click', () => submitTableOrder(true));
  }

  // Fire KOT Only (Open Table Tab)
  if (btnFireKotOnly) {
    btnFireKotOnly.addEventListener('click', () => submitTableOrder(false));
  }

  // --- Mobile Drawer Controls for Android ---
  const posCartPanel = document.querySelector('.pos-cart-panel');
  const cartMobileBackdrop = document.getElementById('cartMobileBackdrop');
  const btnOpenMobileCart = document.getElementById('btnOpenMobileCart');
  const btnCloseMobileCart = document.getElementById('btnCloseMobileCart');
  const tabBtnOpenCart = document.getElementById('tabBtnOpenCart');

  function openMobileCart() {
    if (posCartPanel) posCartPanel.classList.add('mobile-open');
    if (cartMobileBackdrop) cartMobileBackdrop.classList.add('open');
  }

  function closeMobileCart() {
    if (posCartPanel) posCartPanel.classList.remove('mobile-open');
    if (cartMobileBackdrop) cartMobileBackdrop.classList.remove('open');
  }

  if (btnOpenMobileCart) btnOpenMobileCart.addEventListener('click', openMobileCart);
  if (tabBtnOpenCart) tabBtnOpenCart.addEventListener('click', openMobileCart);
  if (btnCloseMobileCart) btnCloseMobileCart.addEventListener('click', closeMobileCart);
  if (cartMobileBackdrop) cartMobileBackdrop.addEventListener('click', closeMobileCart);

  // --- Toast Notifications ---
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

  // Socket.IO events for live table & expense updates
  if (socket) {
    socket.on('order:created', () => { fetchTablesOverview(); fetchExpenseSummary(); });
    socket.on('payment:recorded', () => { fetchTablesOverview(); fetchExpenseSummary(); });
    socket.on('kot:status_change', () => fetchTablesOverview());
    socket.on('tables:count_updated', () => fetchTablesOverview());
    socket.on('expense:recorded', () => { fetchExpenseSummary(); fetchExpensesList(currentExpenseFilter); });
    socket.on('expense:deleted', () => { fetchExpenseSummary(); fetchExpensesList(currentExpenseFilter); });
    socket.on('menu:price_updated', ({ item }) => {
      const idx = menuCatalog.findIndex(m => m._id === item._id);
      if (idx !== -1) {
        menuCatalog[idx] = item;
        renderItems();
      }
    });
  }

  // Initial loads with safety wrapping
  try { fetchMenuCatalog(); } catch (e) { console.error('Menu load failed:', e); }
  try { fetchTablesOverview(); } catch (e) { console.error('Tables load failed:', e); }
  try { fetchExpenseSummary(); } catch (e) { console.error('Expenses load failed:', e); }

  setInterval(() => {
    try { fetchTablesOverview(); } catch (e) {}
    try { fetchExpenseSummary(); } catch (e) {}
  }, 10000);
});
