/**
 * AnchorTrack POS & Table Order Tracking Terminal
 * Ultra-Smooth, Zero-Lag Architecture (Locked 60 FPS)
 * Anchor Cafe - Ramapuram Beach, Chirala
 */

document.addEventListener('DOMContentLoaded', () => {
  // ==========================================================================
  // 1. Audio & Sound Engine
  // ==========================================================================
  const soundEngine = window.soundEngine;
  const btnSoundToggle = document.getElementById('btnSoundToggle');
  if (btnSoundToggle && soundEngine) {
    btnSoundToggle.textContent = soundEngine.isMuted() ? '🔇 Sound: OFF' : '🔊 Sound: ON';
    btnSoundToggle.addEventListener('click', () => {
      const isMuted = soundEngine.toggleMute();
      btnSoundToggle.textContent = isMuted ? '🔇 Sound: OFF' : '🔊 Sound: ON';
      showToast(isMuted ? 'Sound muted' : 'Sound enabled', 'info');
    });
  }

  // ==========================================================================
  // 2. Global State & Multi-Table Cart Persistence
  // ==========================================================================
  let selectedTable = 'Table 1';
  let currentTotalTables = 9;
  let tablesData = [];
  let activeTakeawaysData = [];
  let menuCatalog = [];
  let currentCategory = 'all';
  let searchQuery = '';
  let selectedPaymentMethod = 'PHONEPE';
  let modalActiveOrder = null;
  let lastTablesFingerprint = '';

  // Multi-table draft carts (persisted in localStorage)
  let tableCarts = {};
  try {
    const raw = localStorage.getItem('anchortrack_table_carts_v2');
    if (raw) tableCarts = JSON.parse(raw);
  } catch (e) {
    tableCarts = {};
  }

  function persistTableCarts() {
    try {
      localStorage.setItem('anchortrack_table_carts_v2', JSON.stringify(tableCarts));
    } catch (e) {}
  }

  function getTableCart(tName = selectedTable) {
    if (!tableCarts[tName]) tableCarts[tName] = [];
    return tableCarts[tName];
  }

  function clearTableCart(tName = selectedTable) {
    tableCarts[tName] = [];
    persistTableCarts();
  }

  function getActiveOrderForSelectedTable(tName = selectedTable) {
    if (tName === 'Takeaway') {
      return activeTakeawaysData[0] || null;
    }
    const matched = tablesData.find(t => t.tableNumber === tName);
    return (matched && matched.isOccupied && matched.order) ? matched.order : null;
  }

  // ==========================================================================
  // 3. DOM Elements Cache
  // ==========================================================================
  const tablePillsRow = document.getElementById('tablePillsRow');
  const topActiveTableLabel = document.getElementById('topActiveTableLabel');
  const topActiveTableBill = document.getElementById('topActiveTableBill');
  const btnTopCheckStatus = document.getElementById('btnTopCheckStatus');
  const searchInput = document.getElementById('searchInput');
  const categoryFilterBar = document.getElementById('categoryFilterBar');
  const itemsGrid = document.getElementById('itemsGrid');
  const tabBtnMenuCatalog = document.getElementById('tabBtnMenuCatalog');
  const tabBtnTablesOverview = document.getElementById('tabBtnTablesOverview');
  const viewMenuCatalog = document.getElementById('viewMenuCatalog');
  const viewTablesGrid = document.getElementById('viewTablesGrid');
  const occupiedTablesCount = document.getElementById('occupiedTablesCount');
  const tablesGridOccupiedCount = document.getElementById('tablesGridOccupiedCount');
  const takeawaysCount = document.getElementById('takeawaysCount');
  const nineTablesGrid = document.getElementById('nineTablesGrid');
  const takeawaysGrid = document.getElementById('takeawaysGrid');
  const btnRefreshTables = document.getElementById('btnRefreshTables');
  const posCartPanel = document.getElementById('posCartPanel');
  const cartActiveTableTag = document.getElementById('cartActiveTableTag');
  const cartItemsList = document.getElementById('cartItemsList');
  const subtotalDisplay = document.getElementById('subtotalDisplay');
  const finalTotalDisplay = document.getElementById('finalTotalDisplay');
  const cartCount = document.getElementById('cartCount');
  const guestNameInput = document.getElementById('guestNameInput');
  const btnClearCart = document.getElementById('btnClearCart');
  const btnConfirmPaymentAndOrder = document.getElementById('btnConfirmPaymentAndOrder');
  const btnFireKotOnly = document.getElementById('btnFireKotOnly');
  const mobileFloatingCart = document.getElementById('mobileFloatingCart');
  const mobileCartTableLabel = document.getElementById('mobileCartTableLabel');
  const mobileCartCount = document.getElementById('mobileCartCount');
  const mobileCartTotal = document.getElementById('mobileCartTotal');
  const btnOpenMobileCart = document.getElementById('btnOpenMobileCart');
  const btnMobileReviewAction = document.getElementById('btnMobileReviewAction');
  const btnCloseMobileCart = document.getElementById('btnCloseMobileCart');
  const cartMobileBackdrop = document.getElementById('cartMobileBackdrop');
  const speedBarScroll = document.getElementById('speedBarScroll');

  // Modals
  const tableDetailModal = document.getElementById('tableDetailModal');
  const btnCloseTableModal = document.getElementById('btnCloseTableModal');
  const modalTableTitle = document.getElementById('modalTableTitle');
  const modalTableOrderNum = document.getElementById('modalTableOrderNum');
  const modalTableItemsTbody = document.getElementById('modalTableItemsTbody');
  const modalTableTotalAmount = document.getElementById('modalTableTotalAmount');
  const btnModalPrintBill = document.getElementById('btnModalPrintBill');
  const btnModalShiftTable = document.getElementById('btnModalShiftTable');
  const btnModalAddMoreItems = document.getElementById('btnModalAddMoreItems');
  const btnModalSettlePayment = document.getElementById('btnModalSettlePayment');
  const btnTopShiftTable = document.getElementById('btnTopShiftTable');
  const btnShiftTableCart = document.getElementById('btnShiftTableCart');

  // Shift Table Modal DOM
  const shiftTableModal = document.getElementById('shiftTableModal');
  const btnCloseShiftModal = document.getElementById('btnCloseShiftModal');
  const btnCancelShiftModal = document.getElementById('btnCancelShiftModal');
  const shiftModalSourceTable = document.getElementById('shiftModalSourceTable');
  const shiftModalOrderSummary = document.getElementById('shiftModalOrderSummary');
  const shiftDestinationsGrid = document.getElementById('shiftDestinationsGrid');
  const btnAdvanceStatusAction = document.getElementById('btnAdvanceStatusAction');
  const advanceActionIcon = document.getElementById('advanceActionIcon');
  const advanceActionLabel = document.getElementById('advanceActionLabel');
  const modalStatusBadge = document.getElementById('modalStatusBadge');
  const stepBoxOrdered = document.getElementById('stepBoxOrdered');
  const stepBoxMaking = document.getElementById('stepBoxMaking');
  const stepBoxReady = document.getElementById('stepBoxReady');
  const stepBoxServed = document.getElementById('stepBoxServed');
  const stepBoxPaid = document.getElementById('stepBoxPaid');
  const printableBillReceipt = document.getElementById('printableBillReceipt');

  const shakeVariantModal = document.getElementById('shakeVariantModal');
  const btnCloseVariantModal = document.getElementById('btnCloseVariantModal');
  const btnCancelVariantModal = document.getElementById('btnCancelVariantModal');
  const shakeVariantsList = document.getElementById('shakeVariantsList');
  const shakeModalTitle = document.getElementById('shakeModalTitle');
  let pendingShakeItem = null;

  // ==========================================================================
  // 4. API Calls: Menu & Tables Overview
  // ==========================================================================
  async function fetchMenuCatalog() {
    try {
      const res = await fetch('/api/menu');
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        menuCatalog = data.items.filter(i => i.isAvailable !== false);
        renderItems();
      }
    } catch (e) {
      console.error('Menu load error:', e);
    }
  }

  function computeFingerprint(tables, takeaways, total) {
    const tStr = (tables || []).map(t => `${t.tableNumber}:${t.isOccupied ? (t.order?.orderNumber || 'Y') + (t.order?.orderStatus || '') : 'N'}`).join('|');
    const tkStr = (takeaways || []).map(k => `${k.orderNumber}:${k.orderStatus}`).join('|');
    return `${total}-${tStr}-${tkStr}`;
  }

  async function fetchTablesOverview(forceRender = false) {
    try {
      const res = await fetch('/api/orders/tables');
      const data = await res.json();
      if (data.success) {
        currentTotalTables = data.totalTables || 9;
        tablesData = data.tables || [];
        activeTakeawaysData = data.activeTakeaways || [];

        const fp = computeFingerprint(tablesData, activeTakeawaysData, currentTotalTables);
        if (forceRender || fp !== lastTablesFingerprint) {
          lastTablesFingerprint = fp;
          renderTablePills();
          renderTablesFloorGrid();
          renderTakeawaysFloorGrid();
          renderCart();
        }
      }
    } catch (e) {
      console.error('Tables overview error:', e);
    }
  }

  // ==========================================================================
  // 5. Fast In-Place Table Switcher (Zero Blinking)
  // ==========================================================================
  function renderTablePills() {
    if (!tablePillsRow) return;

    const existingBtns = tablePillsRow.querySelectorAll('.table-pill');
    const expectedCount = currentTotalTables + 1; // 1 to N + Parcel

    if (existingBtns.length === expectedCount) {
      // In-place update: does not tear down DOM nodes
      for (let i = 1; i <= currentTotalTables; i++) {
        const tName = `Table ${i}`;
        const btn = existingBtns[i - 1];
        if (!btn) continue;
        const isSel = selectedTable === tName;
        const matched = tablesData.find(t => t.tableNumber === tName);
        const isOcc = matched && matched.isOccupied;

        btn.classList.toggle('active', isSel);
        btn.classList.toggle('occupied', !!isOcc);
      }

      // Update parcel button
      const parcelBtn = existingBtns[currentTotalTables];
      if (parcelBtn) {
        const isSel = selectedTable === 'Takeaway';
        const isOcc = activeTakeawaysData.length > 0;
        parcelBtn.classList.toggle('active', isSel);
        parcelBtn.classList.toggle('occupied', isOcc);
      }
    } else {
      // Rebuild once if total table count changed
      tablePillsRow.innerHTML = '';
      const fragment = document.createDocumentFragment();

      for (let i = 1; i <= currentTotalTables; i++) {
        const tName = `Table ${i}`;
        const btn = document.createElement('button');
        btn.className = `table-pill ${selectedTable === tName ? 'active' : ''}`;
        btn.setAttribute('data-table', tName);
        btn.textContent = `T${i}`;
        const matched = tablesData.find(t => t.tableNumber === tName);
        if (matched && matched.isOccupied) btn.classList.add('occupied');
        fragment.appendChild(btn);
      }

      const parcelBtn = document.createElement('button');
      parcelBtn.className = `table-pill ${selectedTable === 'Takeaway' ? 'active' : ''}`;
      parcelBtn.setAttribute('data-table', 'Takeaway');
      parcelBtn.textContent = '🛍️ Parcel';
      if (activeTakeawaysData.length > 0) parcelBtn.classList.add('occupied');
      fragment.appendChild(parcelBtn);

      tablePillsRow.appendChild(fragment);
    }

    // Update Top Indicators
    const matched = tablesData.find(t => t.tableNumber === selectedTable);
    const activeOrder = getActiveOrderForSelectedTable();
    const draftCart = getTableCart(selectedTable);

    if (topActiveTableLabel) topActiveTableLabel.textContent = selectedTable;
    if (cartActiveTableTag) cartActiveTableTag.textContent = selectedTable;

    if (topActiveTableBill) {
      if (activeOrder) {
        topActiveTableBill.textContent = `Running: ₹${activeOrder.finalTotalAmount}`;
        topActiveTableBill.style.display = 'inline-block';
        topActiveTableBill.style.background = 'rgba(230, 57, 70, 0.25)';
        topActiveTableBill.style.color = '#FFB4A2';
      } else if (draftCart.length > 0) {
        let draftSum = 0;
        draftCart.forEach(d => { draftSum += d.unitPrice * d.quantity; });
        topActiveTableBill.textContent = `Draft: ₹${draftSum}`;
        topActiveTableBill.style.display = 'inline-block';
        topActiveTableBill.style.background = 'rgba(82, 183, 136, 0.25)';
        topActiveTableBill.style.color = '#52B788';
      } else {
        topActiveTableBill.style.display = 'none';
      }
    }

    if (btnTopCheckStatus) {
      if (activeOrder) {
        const st = activeOrder.orderStatus || 'PENDING';
        let stIcon = '🟡';
        let stText = '1. Ordered';
        if (st === 'KITCHEN_PREPARING' || st === 'ACCEPTED') { stIcon = '🔥'; stText = '2. Making'; }
        else if (st === 'READY_FOR_PICKUP') { stIcon = '🔔'; stText = '3. Ready'; }
        else if (st === 'SERVED') { stIcon = '🍽️'; stText = '4. Served'; }
        btnTopCheckStatus.innerHTML = `📋 ${stIcon} ${stText}`;
        btnTopCheckStatus.style.display = 'inline-block';
      } else {
        btnTopCheckStatus.style.display = 'none';
      }
    }

    if (btnTopShiftTable) {
      if (activeOrder || draftCart.length > 0) {
        btnTopShiftTable.style.display = 'inline-flex';
      } else {
        btnTopShiftTable.style.display = 'none';
      }
    }
  }

  function selectTable(tableName) {
    const wasAlreadySelected = selectedTable === tableName;
    selectedTable = tableName;
    renderTablePills();
    renderCart();

    // If tapping an active table that is already selected, open the status modal immediately
    const activeOrder = getActiveOrderForSelectedTable(tableName);
    if (wasAlreadySelected && activeOrder) {
      openTableDetailModal(tableName, activeOrder);
    }
  }

  // Delegated Table Pill Clicks
  if (tablePillsRow) {
    tablePillsRow.addEventListener('click', (e) => {
      const btn = e.target.closest('.table-pill');
      if (btn) {
        const t = btn.getAttribute('data-table');
        if (t) selectTable(t);
      }
    });
  }

  if (btnTopCheckStatus) {
    btnTopCheckStatus.addEventListener('click', () => {
      const activeOrder = getActiveOrderForSelectedTable();
      if (activeOrder) openTableDetailModal(selectedTable, activeOrder);
    });
  }

  if (btnTopShiftTable) {
    btnTopShiftTable.addEventListener('click', () => {
      openShiftTableModal(selectedTable);
    });
  }

  // ==========================================================================
  // 6. View Mode Switcher: Menu Catalog vs 9-Tables Floor
  // ==========================================================================
  function switchMode(mode) {
    if (mode === 'catalog') {
      tabBtnMenuCatalog.classList.add('active');
      tabBtnTablesOverview.classList.remove('active');
      viewMenuCatalog.style.display = 'flex';
      viewTablesGrid.style.display = 'none';
    } else {
      tabBtnTablesOverview.classList.add('active');
      tabBtnMenuCatalog.classList.remove('active');
      viewMenuCatalog.style.display = 'none';
      viewTablesGrid.style.display = 'block';
      renderTablesFloorGrid();
      renderTakeawaysFloorGrid();
    }
  }

  if (tabBtnMenuCatalog) tabBtnMenuCatalog.addEventListener('click', () => switchMode('catalog'));
  if (tabBtnTablesOverview) tabBtnTablesOverview.addEventListener('click', () => switchMode('floor'));
  if (btnRefreshTables) btnRefreshTables.addEventListener('click', () => fetchTablesOverview(true));

  // ==========================================================================
  // 7. Menu Offerings Grid & Fast Filtering
  // ==========================================================================
  function renderItems() {
    if (!itemsGrid) return;
    itemsGrid.innerHTML = '';

    let filtered = menuCatalog;
    if (currentCategory !== 'all') {
      filtered = filtered.filter(it => it.category === currentCategory);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(it =>
        it.title.toLowerCase().includes(q) ||
        (it.sku && it.sku.toLowerCase().includes(q)) ||
        (it.description && it.description.toLowerCase().includes(q))
      );
    }

    if (filtered.length === 0) {
      itemsGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 3rem 1rem; text-align: center; color: var(--color-foam); opacity: 0.7;">
          <div style="font-size: 2rem; margin-bottom: 0.4rem;">🔍</div>
          <p style="font-weight: 700;">No offerings found</p>
          <small>Try selecting "All Offerings" or clearing your search</small>
        </div>
      `;
      return;
    }

    const fragment = document.createDocumentFragment();

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'menu-card';
      card.setAttribute('data-id', item._id);

      card.innerHTML = `
        <div>
          <h3 class="card-title">${item.title}</h3>
          <p class="card-desc">${item.servingSize ? `${item.servingSize} &bull; ` : ''}${item.description || ''}</p>
        </div>
        <div class="card-bottom">
          <span class="card-price-wrap" data-item-id="${item._id}" data-item-title="${item.title}" data-current-price="${item.sellingPrice}" title="Tap price to increase / decrease">
            <span class="card-price">₹${item.sellingPrice}</span>
            <span class="card-price-edit-icon" title="Edit price">✏️</span>
          </span>
          <button class="btn-add-item" type="button" aria-label="Add ${item.title}">
            ${item.hasVariants ? '⚡ Options' : '➕ Add'}
          </button>
        </div>
      `;

      fragment.appendChild(card);
    });

    itemsGrid.appendChild(fragment);
  }

  // ==========================================================================
  // 7b. Simple Price Editor (Increase / Decrease Stepper)
  // ==========================================================================
  let priceEditorPopup = null;
  let priceEditorBackdrop = null;

  function closePriceEditor() {
    if (priceEditorPopup) { priceEditorPopup.remove(); priceEditorPopup = null; }
    if (priceEditorBackdrop) { priceEditorBackdrop.remove(); priceEditorBackdrop = null; }
  }

  function openPriceEditor(itemId, itemTitle, currentPrice, anchorEl) {
    closePriceEditor();

    // Backdrop
    priceEditorBackdrop = document.createElement('div');
    priceEditorBackdrop.className = 'price-editor-backdrop';
    priceEditorBackdrop.addEventListener('click', closePriceEditor);
    document.body.appendChild(priceEditorBackdrop);

    // Popup
    priceEditorPopup = document.createElement('div');
    priceEditorPopup.className = 'price-editor-popup';

    priceEditorPopup.innerHTML = `
      <div class="price-editor-title">✏️ ${itemTitle}</div>
      <div class="price-editor-subtitle">Adjust item price using - / + or quick buttons</div>

      <div class="price-stepper-box">
        <button type="button" class="btn-step-change" id="btnStepMinus" title="Decrease price by 5">−</button>
        <div class="price-stepper-display">
          <span class="price-currency-sym">₹</span>
          <input class="price-stepper-input" id="pePriceInput" type="number" min="1" step="1" value="${currentPrice}" inputmode="numeric">
        </div>
        <button type="button" class="btn-step-change" id="btnStepPlus" title="Increase price by 5">+</button>
      </div>

      <div class="price-quick-chips">
        <button type="button" class="chip-step-btn" data-delta="-10">−₹10</button>
        <button type="button" class="chip-step-btn" data-delta="-5">−₹5</button>
        <button type="button" class="chip-step-btn" data-delta="5">+₹5</button>
        <button type="button" class="chip-step-btn" data-delta="10">+₹10</button>
      </div>

      <label class="price-editor-toggle">
        <input type="checkbox" id="pePermanent" checked>
        Save permanently to menu (uncheck = session only)
      </label>

      <div class="price-editor-actions">
        <button type="button" class="btn-price-save" id="btnPriceSave">✅ Save Price</button>
        <button type="button" class="btn-price-cancel" id="btnPriceCancel">Cancel</button>
      </div>
    `;

    document.body.appendChild(priceEditorPopup);

    // Center popup nicely on screen (mobile & desktop)
    const popW = Math.min(330, window.innerWidth - 30);
    priceEditorPopup.style.left = `${Math.max(15, (window.innerWidth - popW) / 2)}px`;
    priceEditorPopup.style.top = `${Math.max(40, (window.innerHeight - 280) / 2)}px`;

    const pePriceInput = document.getElementById('pePriceInput');
    const pePermanent = document.getElementById('pePermanent');
    const btnMinus = document.getElementById('btnStepMinus');
    const btnPlus = document.getElementById('btnStepPlus');

    function adjustPrice(delta) {
      let val = parseInt(pePriceInput.value, 10) || 0;
      val = Math.max(1, val + delta);
      pePriceInput.value = val;
    }

    btnMinus.addEventListener('click', () => adjustPrice(-5));
    btnPlus.addEventListener('click', () => adjustPrice(5));

    priceEditorPopup.querySelectorAll('.chip-step-btn').forEach(chip => {
      chip.addEventListener('click', () => {
        const d = parseInt(chip.getAttribute('data-delta'), 10) || 0;
        adjustPrice(d);
      });
    });

    setTimeout(() => { pePriceInput.focus(); pePriceInput.select(); }, 60);

    document.getElementById('btnPriceCancel').addEventListener('click', closePriceEditor);

    document.getElementById('btnPriceSave').addEventListener('click', async () => {
      const newSell = parseInt(pePriceInput.value, 10);
      const isPermanent = pePermanent.checked;

      if (!newSell || newSell < 1) {
        showToast('Please enter a valid price (minimum ₹1)', 'error');
        pePriceInput.focus();
        return;
      }

      // Update in memory immediately for zero lag
      const catalogItem = menuCatalog.find(m => String(m._id) === String(itemId));
      if (catalogItem) {
        catalogItem.sellingPrice = newSell;
        catalogItem.baseCost = newSell;
      }
      renderItems();
      closePriceEditor();
      showToast(`Price updated: ${itemTitle} = ₹${newSell}`, 'success');

      if (isPermanent) {
        try {
          const res = await fetch(`/api/menu/${itemId}/price`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sellingPrice: newSell,
              baseCost: newSell
            })
          });
          const data = await res.json();
          if (!data.success) {
            showToast(data.message || 'Price save failed', 'error');
          }
        } catch (err) {
          showToast('Network error saving price to server', 'error');
        }
      }
    });

    priceEditorPopup.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('btnPriceSave').click();
      if (e.key === 'Escape') closePriceEditor();
    });
  }

  // Delegated listener for price wrap taps
  if (itemsGrid) {
    itemsGrid.addEventListener('click', (e) => {
      const priceWrap = e.target.closest('.card-price-wrap');
      if (priceWrap) {
        e.stopPropagation();
        openPriceEditor(
          priceWrap.getAttribute('data-item-id'),
          priceWrap.getAttribute('data-item-title'),
          Number(priceWrap.getAttribute('data-current-price')),
          priceWrap
        );
        return;
      }
    });
  }

  // Delegated Card Click Listener (Zero Stutter)
  if (itemsGrid) {
    itemsGrid.addEventListener('click', (e) => {
      // Don't trigger card-add if price wrap was tapped
      if (e.target.closest('.card-price-wrap')) return;
      const card = e.target.closest('.menu-card');
      if (card) {
        const id = card.getAttribute('data-id');
        const item = menuCatalog.find(i => String(i._id) === String(id));
        if (item) handleItemSelect(item);
      }
    });
  }

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
        unitPrice: item.sellingPrice
      });
    }
  }

  // Category Tabs
  if (categoryFilterBar) {
    categoryFilterBar.addEventListener('click', (e) => {
      const pill = e.target.closest('.cat-pill');
      if (!pill) return;
      document.querySelectorAll('.cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      currentCategory = pill.getAttribute('data-cat') || 'all';
      renderItems();
    });
  }

  // Fast Search with Debounce
  let searchTimer = null;
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        searchQuery = val;
        renderItems();
      }, 100);
    });
  }

  // Speed Bar 1-Tap Quick Add
  if (speedBarScroll) {
    speedBarScroll.addEventListener('click', (e) => {
      const btn = e.target.closest('.speed-btn');
      if (!btn) return;

      const sku = btn.getAttribute('data-sku');
      const title = btn.getAttribute('data-title');
      const price = Number(btn.getAttribute('data-price')) || 0;

      const matched = menuCatalog.find(m => m.sku === sku || m.title.toLowerCase() === title.toLowerCase());
      addToCart({
        menuItemId: matched ? matched._id : undefined,
        sku: matched ? matched.sku : sku,
        title: matched ? matched.title : title,
        category: matched ? matched.category : 'soft-drinks',
        variant: null,
        unitPrice: matched ? matched.sellingPrice : price
      });
    });
  }

  // ==========================================================================
  // 8. Shake Variant Modal (Clean & Accurate)
  // ==========================================================================
  function openShakeVariantModal(item) {
    if (!shakeVariantModal) return;
    pendingShakeItem = item;
    shakeModalTitle.textContent = item.title;
    shakeVariantsList.innerHTML = '';

    (item.variants || []).forEach(v => {
      const name = v.variantName || v.name || 'Standard';
      const price = v.sellingPrice || v.price || 0;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shake-variant-btn';
      btn.innerHTML = `
        <span style="font-weight: 800; font-size: 0.9rem;">${name}</span>
        <strong style="color: var(--color-gold); font-size: 1rem;">₹${price}</strong>
      `;
      btn.addEventListener('click', () => {
        addToCart({
          menuItemId: item._id,
          sku: item.sku,
          title: item.title,
          category: item.category,
          variant: name,
          unitPrice: price
        });
        closeShakeVariantModal();
      });
      shakeVariantsList.appendChild(btn);
    });

    shakeVariantModal.classList.add('open');
  }

  function closeShakeVariantModal() {
    if (shakeVariantModal) shakeVariantModal.classList.remove('open');
    pendingShakeItem = null;
  }

  if (btnCloseVariantModal) btnCloseVariantModal.addEventListener('click', closeShakeVariantModal);
  if (btnCancelVariantModal) btnCancelVariantModal.addEventListener('click', closeShakeVariantModal);

  // ==========================================================================
  // 9. Cart & Table Order Lifecycle Management
  // ==========================================================================
  function addToCart(item) {
    const currentCart = getTableCart(selectedTable);
    const existing = currentCart.find(c => c.title === item.title && c.variant === item.variant);

    if (existing) {
      existing.quantity += 1;
    } else {
      currentCart.push({ ...item, quantity: 1 });
    }

    persistTableCarts();
    renderTablePills();
    renderCart();

    if (soundEngine && soundEngine.playItemAdd) soundEngine.playItemAdd();
  }

  function changeQty(index, delta) {
    const currentCart = getTableCart(selectedTable);
    if (currentCart[index]) {
      currentCart[index].quantity += delta;
      if (currentCart[index].quantity <= 0) {
        currentCart.splice(index, 1);
      }
      persistTableCarts();
      renderTablePills();
      renderCart();
    }
  }

  function clearCart() {
    clearTableCart(selectedTable);
    renderTablePills();
    renderCart();
  }

  if (btnClearCart) btnClearCart.addEventListener('click', clearCart);

  function calculateCartTotals() {
    const currentCart = getTableCart(selectedTable);
    let subtotal = 0;
    let totalItems = 0;
    currentCart.forEach(it => {
      subtotal += it.unitPrice * it.quantity;
      totalItems += it.quantity;
    });
    return { subtotal, totalItems };
  }

  function renderCart() {
    if (!cartItemsList) return;

    const { subtotal, totalItems } = calculateCartTotals();
    const currentCart = getTableCart(selectedTable);
    const activeOrder = getActiveOrderForSelectedTable();

    cartCount.textContent = totalItems;

    let itemsHtml = '';

    // SECTION 1: Placed Order Stepper & Breakdown (If Table is Occupied)
    if (activeOrder && activeOrder.items && activeOrder.items.length > 0) {
      const st = activeOrder.orderStatus || 'PENDING';
      let badgeColor = '#E76F51';
      let badgeText = '🟡 1. Ordered — Waiting';
      let nextAction = 'KITCHEN_PREPARING';
      let nextLabel = '🔥 Mark as Making / Preparing';
      let nextBg = '#E76F51';
      let nextColor = '#fff';

      if (activeOrder.paymentStatus === 'PAID') {
        badgeColor = 'var(--color-gold)';
        badgeText = '✅ 5. PAID & TABLE FREE';
        nextAction = null;
        nextLabel = 'Completed';
      } else if (st === 'SERVED') {
        badgeColor = '#52B788';
        badgeText = '🍽️ 4. Food Served (Dining)';
        nextAction = 'settle';
        nextLabel = `💳 Collect Payment & Settle Table`;
        nextBg = 'linear-gradient(135deg, var(--color-gold) 0%, #A98344 100%)';
        nextColor = '#06182C';
      } else if (st === 'READY_FOR_PICKUP') {
        badgeColor = '#48CAE4';
        badgeText = '🔔 3. Food Ready at Counter';
        nextAction = 'SERVED';
        nextLabel = '🍽️ Confirm Food Served to Table';
        nextBg = '#52B788';
        nextColor = '#06182C';
      } else if (st === 'KITCHEN_PREPARING' || st === 'ACCEPTED') {
        badgeColor = '#E76F51';
        badgeText = '🔥 2. Kitchen is Making / Preparing';
        nextAction = 'READY_FOR_PICKUP';
        nextLabel = '🔔 Confirm Food is Ready';
        nextBg = '#48CAE4';
        nextColor = '#06182C';
      }

      itemsHtml += `
        <div class="placed-order-card">
          <div class="placed-card-header">
            <span class="placed-card-title">📋 Placed Order (${activeOrder.orderNumber})</span>
            <span class="placed-card-status" style="background: rgba(201,168,106,0.18); color: ${badgeColor};">
              ${activeOrder.paymentStatus === 'PAID' ? '✅ Paid & Free' : badgeText}
            </span>
          </div>

          <div class="placed-items-list">
      `;

      activeOrder.items.forEach(it => {
        itemsHtml += `
          <div class="placed-item-line">
            <span><strong style="color: var(--color-gold);">${it.quantity}x</strong> ${it.title}${it.variant ? ` <small>(${it.variant})</small>` : ''}</span>
            <span style="font-weight: 700;">₹${it.subtotal || (it.unitPrice * it.quantity)}</span>
          </div>
        `;
      });

      itemsHtml += `
          </div>

          <div class="placed-subtotal-line">
            <span>Running Bill Total:</span>
            <span style="color: var(--color-gold);">₹${activeOrder.finalTotalAmount}</span>
          </div>

          <div style="margin-top: 0.5rem; padding-top: 0.45rem; border-top: 1px dashed rgba(201, 168, 106, 0.25);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <span style="font-size: 0.72rem; color: var(--color-sand-muted); font-weight: 600;">Status Progression:</span>
              <span style="font-size: 0.72rem; font-weight: 800; color: ${badgeColor};">${badgeText}</span>
            </div>
            ${nextAction ? `
              <button class="btn-cart-advance-status" data-order-id="${activeOrder._id || activeOrder.orderNumber}" data-target-action="${nextAction}" style="background: ${nextBg}; color: ${nextColor};">
                ${nextLabel} &rarr;
              </button>
            ` : ''}
          </div>
        </div>
      `;
    }

    // SECTION 2: Draft Items in Cart
    if (currentCart.length > 0) {
      if (activeOrder) {
        itemsHtml += `
          <div style="font-size: 0.75rem; font-weight: 800; color: #48CAE4; text-transform: uppercase; margin-bottom: 0.4rem; display: flex; justify-content: space-between;">
            <span>➕ Additions (Water / Food):</span>
            <span style="color: var(--color-gold);">+₹${subtotal}</span>
          </div>
        `;
      }

      currentCart.forEach((item, idx) => {
        itemsHtml += `
          <div class="cart-item-row">
            <div class="item-info-col">
              <div class="item-info-title">${item.title}</div>
              <div class="item-info-price">${item.variant ? `${item.variant} &bull; ` : ''}₹${item.unitPrice} each</div>
            </div>
            <div class="qty-controls">
              <button class="btn-qty" data-idx="${idx}" data-delta="-1">-</button>
              <span class="qty-num">${item.quantity}</span>
              <button class="btn-qty" data-idx="${idx}" data-delta="1">+</button>
            </div>
            <div class="item-subtotal">₹${item.unitPrice * item.quantity}</div>
          </div>
        `;
      });
    } else if (!activeOrder) {
      itemsHtml = `
        <div class="cart-empty-state">
          <div class="empty-icon">☕</div>
          <p>${selectedTable} is empty</p>
          <small>Tap water bottle, soft drinks, coffee, or snacks to add</small>
        </div>
      `;
    } else {
      itemsHtml += `
        <div style="text-align: center; padding: 0.75rem; border: 1px dashed rgba(201, 168, 106, 0.25); border-radius: var(--radius-sm); color: var(--color-sand-muted); font-size: 0.75rem;">
          Tap any menu item (like water bottles or snacks) to append extra items to ${selectedTable}'s bill.
        </div>
      `;
    }

    cartItemsList.innerHTML = itemsHtml;

    // Attach listeners for draft qty controls
    cartItemsList.querySelectorAll('.btn-qty').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const i = parseInt(btn.getAttribute('data-idx'), 10);
        const d = parseInt(btn.getAttribute('data-delta'), 10);
        changeQty(i, d);
      });
    });

    // Attach listener for cart status advance button
    const btnCartAdvance = cartItemsList.querySelector('.btn-cart-advance-status');
    if (btnCartAdvance) {
      btnCartAdvance.addEventListener('click', async (e) => {
        e.stopPropagation();
        const orderId = btnCartAdvance.getAttribute('data-order-id');
        const targetAction = btnCartAdvance.getAttribute('data-target-action');
        if (targetAction === 'settle') {
          if (btnConfirmPaymentAndOrder) btnConfirmPaymentAndOrder.click();
        } else if (targetAction && orderId) {
          await advanceOrderStatus(orderId, targetAction);
        }
      });
    }

    // Update Totals & Settlement Action Buttons
    if (activeOrder) {
      const runningBill = Number(activeOrder.finalTotalAmount) || 0;
      const combinedTotal = runningBill + subtotal;

      if (subtotal > 0) {
        subtotalDisplay.textContent = `+₹${subtotal} (New Items)`;
        finalTotalDisplay.textContent = `₹${combinedTotal} (Total Due)`;
        if (btnFireKotOnly) btnFireKotOnly.textContent = `➕ Add Items to Table Tab`;
        if (btnConfirmPaymentAndOrder) btnConfirmPaymentAndOrder.textContent = `💳 Settle Full Bill (₹${combinedTotal})`;
      } else {
        subtotalDisplay.textContent = `₹0`;
        finalTotalDisplay.textContent = `₹${runningBill} (Total Due)`;
        if (btnFireKotOnly) btnFireKotOnly.textContent = `💾 Save to Table Tab`;
        if (btnConfirmPaymentAndOrder) btnConfirmPaymentAndOrder.textContent = `💳 1-Tap Settle & Free ${selectedTable} (₹${runningBill})`;
      }
    } else {
      subtotalDisplay.textContent = `₹${subtotal}`;
      finalTotalDisplay.textContent = `₹${subtotal}`;
      if (btnFireKotOnly) btnFireKotOnly.textContent = `💾 Save to Table Tab`;
      if (btnConfirmPaymentAndOrder) btnConfirmPaymentAndOrder.textContent = `1-Tap: Confirm & Settle`;
    }

    // Update Mobile Floating Bottom Bar
    const runningAmt = activeOrder ? Number(activeOrder.finalTotalAmount) : 0;
    const mobileGrandTotal = runningAmt + subtotal;
    const mobileGrandCount = totalItems + (activeOrder ? activeOrder.totalItemCount : 0);

    if (mobileCartTableLabel) mobileCartTableLabel.textContent = selectedTable;
    if (mobileCartCount) mobileCartCount.textContent = mobileGrandCount;
    if (mobileCartTotal) mobileCartTotal.textContent = `₹${mobileGrandTotal}`;

    if (btnShiftTableCart) {
      if (activeOrder || currentCart.length > 0) {
        btnShiftTableCart.style.display = 'inline-flex';
      } else {
        btnShiftTableCart.style.display = 'none';
      }
    }
  }

  // Payment Method Ticks
  document.querySelectorAll('.pay-tick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.pay-tick-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedPaymentMethod = btn.getAttribute('data-method') || 'PHONEPE';
    });
  });

  // Action: Advance Order Status (1-Tap Progression)
  async function advanceOrderStatus(orderId, nextStatus) {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });
      const data = await res.json();
      if (data.success && data.order) {
        if (modalActiveOrder && (String(modalActiveOrder._id) === String(orderId) || modalActiveOrder.orderNumber === orderId)) {
          modalActiveOrder = data.order;
          updateModalStatusView(data.order);
        }
        showToast(`Table confirmed: ${nextStatus}!`, 'success');
        if (soundEngine && soundEngine.playChime) soundEngine.playChime();
        fetchTablesOverview(true);
      } else {
        showToast(data.message || 'Status update failed', 'error');
      }
    } catch (err) {
      console.error('Status transition error:', err);
      showToast('Could not update status', 'error');
    }
  }

  // Action: Submit Order (Save to Tab OR Settle Immediately)
  async function submitTableOrder(isPaidImmediately = false) {
    const currentCart = getTableCart(selectedTable);
    const activeOrder = getActiveOrderForSelectedTable();

    // Case 1: Settle existing running table tab with no new draft items
    if (activeOrder && currentCart.length === 0) {
      if (!isPaidImmediately) {
        showToast(`Order for ${selectedTable} is already saved and active!`, 'info');
        return;
      }

      btnConfirmPaymentAndOrder.disabled = true;
      btnConfirmPaymentAndOrder.textContent = 'Processing Settlement...';

      try {
        const settleRes = await fetch('/api/orders/tables/settle', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId: activeOrder._id || activeOrder.orderNumber,
            tableNumber: selectedTable,
            paymentMethod: selectedPaymentMethod,
            amountReceived: activeOrder.finalTotalAmount
          })
        });

        const settleData = await settleRes.json();
        if (settleData.success) {
          clearTableCart(selectedTable);
          showToast(`Table ${selectedTable} settled via ${selectedPaymentMethod}! Table is now FREE.`, 'success');
          if (soundEngine && soundEngine.playPaymentSuccess) soundEngine.playPaymentSuccess();
          if (posCartPanel) posCartPanel.classList.remove('mobile-open');
          if (cartMobileBackdrop) cartMobileBackdrop.classList.remove('open');
          fetchTablesOverview(true);
        } else {
          showToast(settleData.message || 'Settlement failed', 'error');
        }
      } catch (err) {
        showToast(`Settlement error: ${err.message}`, 'error');
      } finally {
        btnConfirmPaymentAndOrder.disabled = false;
        renderCart();
      }
      return;
    }

    // Case 2: New items in cart to place or append
    if (currentCart.length === 0) {
      showToast('Cart is empty. Tap any menu item to add.', 'warning');
      return;
    }

    const targetBtn = isPaidImmediately ? btnConfirmPaymentAndOrder : btnFireKotOnly;
    targetBtn.disabled = true;
    const originalText = targetBtn.textContent;
    targetBtn.textContent = 'Submitting...';

    const orderPayload = {
      orderType: selectedTable === 'Takeaway' ? 'TAKEAWAY' : 'DINE_IN',
      locationDetails: {
        tableNumber: selectedTable,
        customerName: (guestNameInput && guestNameInput.value.trim()) || 'Guest'
      },
      items: currentCart.map(it => ({
        menuItemId: it.menuItemId,
        sku: it.sku,
        title: it.title,
        category: it.category,
        variant: it.variant,
        unitPrice: it.unitPrice,
        quantity: it.quantity
      })),
      paymentMethod: selectedPaymentMethod,
      paymentStatus: isPaidImmediately ? 'PAID' : 'UNPAID'
    };

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });

      const data = await res.json();
      if (data.success && data.order) {
        clearTableCart(selectedTable);

        if (isPaidImmediately) {
          showToast(`Order confirmed & settled for ${selectedTable}!`, 'success');
          if (soundEngine && soundEngine.playPaymentSuccess) soundEngine.playPaymentSuccess();
        } else {
          showToast(`Order ticket sent to kitchen for ${selectedTable}!`, 'success');
          if (soundEngine && soundEngine.playNewOrderChime) soundEngine.playNewOrderChime();
        }

        if (posCartPanel) posCartPanel.classList.remove('mobile-open');
        if (cartMobileBackdrop) cartMobileBackdrop.classList.remove('open');
        fetchTablesOverview(true);
      } else {
        showToast(data.message || 'Failed to place order', 'error');
      }
    } catch (err) {
      showToast(`Network error: ${err.message}`, 'error');
    } finally {
      targetBtn.disabled = false;
      targetBtn.textContent = originalText;
    }
  }

  if (btnConfirmPaymentAndOrder) {
    btnConfirmPaymentAndOrder.addEventListener('click', () => submitTableOrder(true));
  }
  if (btnFireKotOnly) {
    btnFireKotOnly.addEventListener('click', () => submitTableOrder(false));
  }

  // ==========================================================================
  // 10. Floor View: Tables & Takeaways Grid
  // ==========================================================================
  function renderTablesFloorGrid() {
    if (!nineTablesGrid) return;
    nineTablesGrid.innerHTML = '';
    let occupiedCount = 0;

    tablesData.forEach(tbl => {
      if (tbl.isOccupied) occupiedCount++;

      const card = document.createElement('div');
      card.className = `table-floor-card ${tbl.isOccupied ? 'occupied' : 'vacant'}`;

      let billHtml = '₹0';
      let itemsSummaryHtml = 'Ready for dining guests';
      let badgeClass = 'vacant';
      let badgeText = '🟢 Available';

      if (tbl.isOccupied && tbl.order) {
        billHtml = `₹${tbl.order.finalTotalAmount}`;
        const itemNames = tbl.order.items.map(it => `${it.quantity}x ${it.title}`).join(', ');
        itemsSummaryHtml = `${tbl.order.totalItemCount} items: ${itemNames}`;

        const st = tbl.order.orderStatus || 'PENDING';
        if (st === 'READY_FOR_PICKUP') {
          badgeClass = 'ready';
          badgeText = '🔔 Food Ready';
        } else if (st === 'SERVED') {
          badgeClass = 'served';
          badgeText = '🍽️ Food Served';
        } else {
          badgeClass = 'occupied';
          badgeText = '🟡 1. Ordered';
        }
      }

      card.innerHTML = `
        <div class="table-card-top">
          <span class="table-card-name">${tbl.tableNumber}</span>
          <span class="table-card-badge ${badgeClass}">${badgeText}</span>
        </div>
        <div class="table-bill-amount">${billHtml}</div>
        <div class="table-items-preview">${itemsSummaryHtml}</div>
        ${tbl.isOccupied ? `
          <button class="btn-floor-shift" data-table="${tbl.tableNumber}" type="button">
            🔀 Shift ${tbl.tableNumber}
          </button>
        ` : ''}
      `;

      const floorShiftBtn = card.querySelector('.btn-floor-shift');
      if (floorShiftBtn) {
        floorShiftBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          selectTable(tbl.tableNumber);
          openShiftTableModal(tbl.tableNumber);
        });
      }

      card.addEventListener('click', () => {
        selectTable(tbl.tableNumber);
        if (tbl.isOccupied && tbl.order) {
          openTableDetailModal(tbl.tableNumber, tbl.order);
        } else {
          switchMode('catalog');
          showToast(`Selected ${tbl.tableNumber} for new order`, 'info');
        }
      });

      nineTablesGrid.appendChild(card);
    });

    if (occupiedTablesCount) occupiedTablesCount.textContent = occupiedCount;
    if (tablesGridOccupiedCount) tablesGridOccupiedCount.textContent = occupiedCount;
    document.querySelectorAll('.occupied-count-mirror').forEach(el => el.textContent = occupiedCount);
  }

  function renderTakeawaysFloorGrid() {
    if (!takeawaysGrid) return;
    takeawaysGrid.innerHTML = '';
    const count = activeTakeawaysData.length;
    if (takeawaysCount) takeawaysCount.textContent = count;

    if (count === 0) {
      takeawaysGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 1.25rem; text-align: center; color: var(--color-foam); opacity: 0.75; font-size: 0.82rem; border: 1px dashed rgba(72, 202, 228, 0.3); border-radius: var(--radius-sm);">
          🛍️ No active takeaway parcel orders right now.
        </div>
      `;
      return;
    }

    activeTakeawaysData.forEach(order => {
      const card = document.createElement('div');
      card.className = 'table-floor-card occupied';
      const itemNames = (order.items || []).map(it => `${it.quantity}x ${it.title}`).join(', ');

      card.innerHTML = `
        <div class="table-card-top">
          <span class="table-card-name">🛍️ ${order.orderNumber}</span>
          <span class="table-card-badge occupied">${order.orderStatus}</span>
        </div>
        <div class="table-bill-amount">₹${order.finalTotalAmount}</div>
        <div class="table-items-preview">${order.totalItemCount} items: ${itemNames}</div>
      `;

      card.addEventListener('click', () => {
        selectTable('Takeaway');
        openTableDetailModal(`Takeaway: ${order.orderNumber}`, order);
      });

      takeawaysGrid.appendChild(card);
    });
  }

  // ==========================================================================
  // 11. Live Table Detail Modal (Lifecycle Stepper & Thermal Bill Print)
  // ==========================================================================
  function openTableDetailModal(tableName, order) {
    modalActiveOrder = order;
    modalTableTitle.textContent = `${tableName} Order Details`;
    modalTableOrderNum.textContent = `Ticket: ${order.orderNumber} • ${new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    modalTableTotalAmount.textContent = `₹${order.finalTotalAmount}`;

    updateModalStatusView(order);

    modalTableItemsTbody.innerHTML = '';
    (order.items || []).forEach(it => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td style="font-weight: 700; color: var(--color-gold);">${it.quantity}x</td>
        <td><strong>${it.title}</strong>${it.variant ? ` <small>(${it.variant})</small>` : ''}</td>
        <td style="text-align: right; color: var(--color-foam); opacity: 0.85;">₹${it.unitPrice}</td>
        <td style="text-align: right; font-weight: 700; color: var(--color-gold);">₹${it.subtotal || (it.unitPrice * it.quantity)}</td>
      `;
      modalTableItemsTbody.appendChild(tr);
    });

    tableDetailModal.classList.add('open');
  }

  function updateModalStatusView(order) {
    if (!order) return;
    const status = order.orderStatus || 'PENDING';
    const isPaid = order.paymentStatus === 'PAID';

    [stepBoxOrdered, stepBoxMaking, stepBoxReady, stepBoxServed, stepBoxPaid].forEach(box => {
      if (box) box.className = 'step-box';
    });

    if (isPaid) {
      if (modalStatusBadge) {
        modalStatusBadge.textContent = '✅ 5. PAID & TABLE FREE';
        modalStatusBadge.style.background = 'rgba(201, 168, 106, 0.25)';
        modalStatusBadge.style.color = 'var(--color-gold)';
      }
      if (stepBoxPaid) stepBoxPaid.className = 'step-box active-paid';
      if (btnAdvanceStatusAction) {
        btnAdvanceStatusAction.style.background = '#52B788';
        btnAdvanceStatusAction.style.color = '#06182C';
        if (advanceActionIcon) advanceActionIcon.textContent = '✅';
        if (advanceActionLabel) advanceActionLabel.textContent = 'Table Paid & Completed';
        btnAdvanceStatusAction.disabled = true;
      }
    } else if (status === 'SERVED') {
      if (modalStatusBadge) {
        modalStatusBadge.textContent = '🍽️ 4. SERVED TO TABLE';
        modalStatusBadge.style.background = 'rgba(82, 183, 136, 0.25)';
        modalStatusBadge.style.color = '#52B788';
      }
      if (stepBoxServed) stepBoxServed.className = 'step-box active-served';
      if (btnAdvanceStatusAction) {
        btnAdvanceStatusAction.style.background = 'linear-gradient(135deg, var(--color-gold) 0%, #A98344 100%)';
        btnAdvanceStatusAction.style.color = '#06182C';
        if (advanceActionIcon) advanceActionIcon.textContent = '💳';
        if (advanceActionLabel) advanceActionLabel.textContent = `Collect Payment & Settle (₹${order.finalTotalAmount})`;
        btnAdvanceStatusAction.disabled = false;
        btnAdvanceStatusAction.setAttribute('data-target-action', 'settle');
      }
    } else if (status === 'READY_FOR_PICKUP') {
      if (modalStatusBadge) {
        modalStatusBadge.textContent = '🔔 3. FOOD READY AT COUNTER';
        modalStatusBadge.style.background = 'rgba(72, 202, 228, 0.25)';
        modalStatusBadge.style.color = '#48CAE4';
      }
      if (stepBoxReady) stepBoxReady.className = 'step-box active-ready';
      if (btnAdvanceStatusAction) {
        btnAdvanceStatusAction.style.background = '#52B788';
        btnAdvanceStatusAction.style.color = '#06182C';
        if (advanceActionIcon) advanceActionIcon.textContent = '🍽️';
        if (advanceActionLabel) advanceActionLabel.textContent = 'Confirm Food Served to Table';
        btnAdvanceStatusAction.disabled = false;
        btnAdvanceStatusAction.setAttribute('data-target-action', 'SERVED');
      }
    } else if (status === 'KITCHEN_PREPARING' || status === 'ACCEPTED') {
      if (modalStatusBadge) {
        modalStatusBadge.textContent = '🔥 2. KITCHEN MAKING / PREPARING';
        modalStatusBadge.style.background = 'rgba(231, 111, 81, 0.25)';
        modalStatusBadge.style.color = '#E76F51';
      }
      if (stepBoxMaking) stepBoxMaking.className = 'step-box active-making';
      if (btnAdvanceStatusAction) {
        btnAdvanceStatusAction.style.background = '#48CAE4';
        btnAdvanceStatusAction.style.color = '#06182C';
        if (advanceActionIcon) advanceActionIcon.textContent = '🔔';
        if (advanceActionLabel) advanceActionLabel.textContent = 'Confirm Food is Ready at Counter';
        btnAdvanceStatusAction.disabled = false;
        btnAdvanceStatusAction.setAttribute('data-target-action', 'READY_FOR_PICKUP');
      }
    } else {
      // PENDING — Just placed, waiting to be picked up by kitchen
      if (modalStatusBadge) {
        modalStatusBadge.textContent = '🟡 1. ORDERED — WAITING';
        modalStatusBadge.style.background = 'rgba(231, 111, 81, 0.15)';
        modalStatusBadge.style.color = '#E76F51';
      }
      if (stepBoxOrdered) stepBoxOrdered.className = 'step-box active-pending';
      if (btnAdvanceStatusAction) {
        btnAdvanceStatusAction.style.background = '#E76F51';
        btnAdvanceStatusAction.style.color = '#fff';
        if (advanceActionIcon) advanceActionIcon.textContent = '🔥';
        if (advanceActionLabel) advanceActionLabel.textContent = 'Mark as Making / Preparing';
        btnAdvanceStatusAction.disabled = false;
        btnAdvanceStatusAction.setAttribute('data-target-action', 'KITCHEN_PREPARING');
      }
    }
  }

  if (btnAdvanceStatusAction) {
    btnAdvanceStatusAction.addEventListener('click', async () => {
      if (!modalActiveOrder) return;
      const targetAction = btnAdvanceStatusAction.getAttribute('data-target-action');
      if (targetAction === 'settle') {
        if (btnModalSettlePayment) btnModalSettlePayment.click();
      } else if (targetAction) {
        await advanceOrderStatus(modalActiveOrder._id || modalActiveOrder.orderNumber, targetAction);
      }
    });
  }

  if (btnCloseTableModal) {
    btnCloseTableModal.addEventListener('click', () => {
      if (tableDetailModal) tableDetailModal.classList.remove('open');
      modalActiveOrder = null;
    });
  }

  if (btnModalAddMoreItems) {
    btnModalAddMoreItems.addEventListener('click', () => {
      const targetTbl = (modalActiveOrder && modalActiveOrder.locationDetails?.tableNumber) || selectedTable;
      selectTable(targetTbl);
      if (tableDetailModal) tableDetailModal.classList.remove('open');
      modalActiveOrder = null;
      switchMode('catalog');
      showToast(`Selected ${selectedTable}! Tap items to add to bill.`, 'info');
    });
  }

  if (btnModalSettlePayment) {
    btnModalSettlePayment.addEventListener('click', () => {
      const targetTbl = (modalActiveOrder && modalActiveOrder.locationDetails?.tableNumber) || selectedTable;
      selectTable(targetTbl);
      if (tableDetailModal) tableDetailModal.classList.remove('open');
      modalActiveOrder = null;
      submitTableOrder(true);
    });
  }

  // Thermal Receipt Printing
  function printOrderReceipt(order, tableName) {
    if (!order || !printableBillReceipt) return;
    const dateStr = new Date(order.createdAt || Date.now()).toLocaleString();
    let rowsHtml = '';
    (order.items || []).forEach(it => {
      rowsHtml += `
        <tr>
          <td>${it.quantity}x</td>
          <td>${it.title}${it.variant ? ` (${it.variant})` : ''}</td>
          <td style="text-align: right;">₹${it.unitPrice}</td>
          <td style="text-align: right;">₹${it.subtotal || (it.unitPrice * it.quantity)}</td>
        </tr>
      `;
    });

    printableBillReceipt.innerHTML = `
      <div style="font-family: monospace; font-size: 12px; width: 280px; padding: 10px; color: #000; background: #FFF;">
        <div style="text-align: center; font-weight: bold; font-size: 14px;">⚓ ANCHOR CAFE ⚓</div>
        <div style="text-align: center; font-size: 10px;">Ramapuram Beach, Chirala (A.P.)</div>
        <div style="text-align: center; margin-top: 5px; font-weight: bold;">${tableName || order.locationDetails?.tableNumber || 'Beach Order'}</div>
        <div style="font-size: 10px; margin-top: 5px;">Order: ${order.orderNumber}</div>
        <div style="font-size: 10px;">Date: ${dateStr}</div>
        <hr style="border-top: 1px dashed #000; margin: 8px 0;">
        <table style="width: 100%; font-size: 11px;">
          ${rowsHtml}
        </table>
        <hr style="border-top: 1px dashed #000; margin: 8px 0;">
        <div style="display: flex; justify-content: space-between; font-weight: bold; font-size: 13px;">
          <span>TOTAL:</span>
          <span>₹${order.finalTotalAmount}</span>
        </div>
        <div style="text-align: center; margin-top: 10px; font-size: 10px;">Thank you! Visit again! 🌊</div>
      </div>
    `;

    window.print();
  }

  if (btnModalPrintBill) {
    btnModalPrintBill.addEventListener('click', () => {
      if (modalActiveOrder) {
        printOrderReceipt(modalActiveOrder, modalActiveOrder.locationDetails?.tableNumber);
      }
    });
  }

  // ==========================================================================
  // 12. Fast 1-Tap Table Shifting & Merging (Busy Rush Crowd Manager)
  // ==========================================================================
  let currentShiftSourceTable = null;

  function openShiftTableModal(sourceTable = selectedTable) {
    if (!shiftTableModal) return;
    currentShiftSourceTable = sourceTable;

    if (shiftModalSourceTable) shiftModalSourceTable.textContent = sourceTable;

    const activeOrder = getActiveOrderForSelectedTable(sourceTable);
    const draftCart = getTableCart(sourceTable);

    if (shiftModalOrderSummary) {
      if (activeOrder) {
        const count = activeOrder.totalItemCount || activeOrder.items?.length || 0;
        shiftModalOrderSummary.textContent = `(${count} items • ₹${activeOrder.finalTotalAmount})`;
      } else if (draftCart && draftCart.length > 0) {
        let draftSum = 0;
        draftCart.forEach(d => { draftSum += (d.unitPrice * d.quantity); });
        shiftModalOrderSummary.textContent = `(${draftCart.length} draft items • ₹${draftSum})`;
      } else {
        shiftModalOrderSummary.textContent = `(Vacant table)`;
      }
    }

    if (shiftDestinationsGrid) {
      shiftDestinationsGrid.innerHTML = '';
      const fragment = document.createDocumentFragment();

      // Render 1 to N dining tables
      for (let i = 1; i <= currentTotalTables; i++) {
        const tName = `Table ${i}`;
        const isCurrent = tName === sourceTable;
        const matched = tablesData.find(t => t.tableNumber === tName);
        const isOcc = matched && matched.isOccupied && matched.order;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.setAttribute('data-target-table', tName);

        if (isCurrent) {
          btn.className = 'shift-dest-btn current';
          btn.disabled = true;
          btn.innerHTML = `
            <div class="shift-dest-num">T${i}</div>
            <div class="shift-dest-status">Current Table</div>
          `;
        } else if (isOcc) {
          btn.className = 'shift-dest-btn occupied';
          btn.innerHTML = `
            <div class="shift-dest-num">T${i}</div>
            <div class="shift-dest-status">🟡 ₹${matched.order.finalTotalAmount} (Merge)</div>
          `;
          btn.addEventListener('click', () => {
            executeTableShift(sourceTable, tName, true, matched.order.finalTotalAmount);
          });
        } else {
          btn.className = 'shift-dest-btn vacant';
          btn.innerHTML = `
            <div class="shift-dest-num">T${i}</div>
            <div class="shift-dest-status">🟢 Vacant (Move)</div>
          `;
          btn.addEventListener('click', () => {
            executeTableShift(sourceTable, tName, false, 0);
          });
        }

        fragment.appendChild(btn);
      }

      // Also render Parcel / Takeaway option
      const isCurrentTakeaway = sourceTable === 'Takeaway';
      const takeawayBtn = document.createElement('button');
      takeawayBtn.type = 'button';
      takeawayBtn.setAttribute('data-target-table', 'Takeaway');
      if (isCurrentTakeaway) {
        takeawayBtn.className = 'shift-dest-btn current';
        takeawayBtn.disabled = true;
        takeawayBtn.innerHTML = `
          <div class="shift-dest-num">🛍️</div>
          <div class="shift-dest-status">Current Parcel</div>
        `;
      } else if (activeTakeawaysData.length > 0) {
        takeawayBtn.className = 'shift-dest-btn occupied';
        takeawayBtn.innerHTML = `
          <div class="shift-dest-num">🛍️</div>
          <div class="shift-dest-status">🟡 Parcel (Merge)</div>
        `;
        takeawayBtn.addEventListener('click', () => {
          executeTableShift(sourceTable, 'Takeaway', true, activeTakeawaysData[0]?.finalTotalAmount || 0);
        });
      } else {
        takeawayBtn.className = 'shift-dest-btn vacant';
        takeawayBtn.innerHTML = `
          <div class="shift-dest-num">🛍️</div>
          <div class="shift-dest-status">🟢 To Parcel</div>
        `;
        takeawayBtn.addEventListener('click', () => {
          executeTableShift(sourceTable, 'Takeaway', false, 0);
        });
      }
      fragment.appendChild(takeawayBtn);

      shiftDestinationsGrid.appendChild(fragment);
    }

    shiftTableModal.classList.add('open');
  }

  function closeShiftTableModal() {
    if (shiftTableModal) shiftTableModal.classList.remove('open');
    currentShiftSourceTable = null;
  }

  async function executeTableShift(fromTable, toTable, isTargetOccupied, targetBill) {
    if (isTargetOccupied) {
      const confirmMerge = window.confirm(
        `Table Shift & Merge:\n\n` +
        `${toTable} already has an active order (₹${targetBill}).\n\n` +
        `Do you want to MERGE ${fromTable}'s items into ${toTable}'s bill?`
      );
      if (!confirmMerge) return;
    }

    try {
      // 1. Call backend shift API
      const res = await fetch('/api/orders/tables/shift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromTable, toTable })
      });
      const data = await res.json();

      if (data.success) {
        // 2. Migrate any local draft cart items
        if (tableCarts[fromTable] && tableCarts[fromTable].length > 0) {
          if (!tableCarts[toTable]) tableCarts[toTable] = [];
          tableCarts[toTable] = [...tableCarts[toTable], ...tableCarts[fromTable]];
          delete tableCarts[fromTable];
          persistTableCarts();
        }

        closeShiftTableModal();
        if (tableDetailModal) tableDetailModal.classList.remove('open');

        // 3. Switch to target table and refresh
        selectTable(toTable);
        await fetchTablesOverview(true);

        showToast(data.message || `Successfully moved order to ${toTable}!`, 'success');
      } else {
        showToast(data.message || 'Failed to shift table', 'error');
      }
    } catch (err) {
      showToast(`Network error shifting table: ${err.message}`, 'error');
    }
  }

  if (btnShiftTableCart) {
    btnShiftTableCart.addEventListener('click', () => {
      openShiftTableModal(selectedTable);
    });
  }

  if (btnModalShiftTable) {
    btnModalShiftTable.addEventListener('click', () => {
      const targetTbl = (modalActiveOrder && modalActiveOrder.locationDetails?.tableNumber) || selectedTable;
      if (tableDetailModal) tableDetailModal.classList.remove('open');
      openShiftTableModal(targetTbl);
    });
  }

  if (btnCloseShiftModal) btnCloseShiftModal.addEventListener('click', closeShiftTableModal);
  if (btnCancelShiftModal) btnCancelShiftModal.addEventListener('click', closeShiftTableModal);

  // ==========================================================================
  // 12. Mobile Cart Drawer Open & Close
  // ==========================================================================
  function openMobileCart() {
    if (posCartPanel) posCartPanel.classList.add('mobile-open');
    if (cartMobileBackdrop) cartMobileBackdrop.classList.add('open');
    renderCart();
  }

  function closeMobileCart() {
    if (posCartPanel) posCartPanel.classList.remove('mobile-open');
    if (cartMobileBackdrop) cartMobileBackdrop.classList.remove('open');
  }

  if (btnOpenMobileCart) btnOpenMobileCart.addEventListener('click', openMobileCart);
  if (btnMobileReviewAction) btnMobileReviewAction.addEventListener('click', openMobileCart);
  if (btnCloseMobileCart) btnCloseMobileCart.addEventListener('click', closeMobileCart);
  if (cartMobileBackdrop) cartMobileBackdrop.addEventListener('click', closeMobileCart);

  // ==========================================================================
  // 13. Toast Notification Utility (Clean & Non-Intrusive)
  // ==========================================================================
  function showToast(message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.style.cssText = 'position: fixed; top: 1rem; right: 1rem; z-index: 9999; display: flex; flex-direction: column; gap: 0.4rem; pointer-events: none;';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const bg = type === 'success' ? '#2A9D8F' : (type === 'error' ? '#E63946' : '#1D4E89');
    toast.style.cssText = `background: ${bg}; color: #FFF; padding: 0.5rem 0.85rem; border-radius: 6px; font-size: 0.82rem; font-weight: 700; box-shadow: 0 4px 15px rgba(0,0,0,0.4); pointer-events: auto;`;
    toast.textContent = message;

    container.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 2400);
  }

  // ==========================================================================
  // 14. Realtime Socket.IO Listeners
  // ==========================================================================
  if (typeof io !== 'undefined') {
    try {
      const socket = io();
      socket.on('order:created', () => fetchTablesOverview(true));
      socket.on('kot:status_change', () => fetchTablesOverview(true));
      socket.on('payment:recorded', () => fetchTablesOverview(true));
    } catch (e) {}
  }

  // Initial Load
  fetchMenuCatalog();
  fetchTablesOverview(true);

  // Fallback poll every 25 seconds
  setInterval(() => {
    fetchTablesOverview(false);
  }, 25000);
});
