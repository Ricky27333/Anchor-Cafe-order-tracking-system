/**
 * AnchorTrack Kitchen Display System (KDS / KOT) Logic
 * Real-time order synchronization via Socket.io, station filtering, elapsed timers,
 * and audio chime/bell alerts for new tickets & plated orders.
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
      showToast(isMuted ? 'Kitchen sound muted' : 'Kitchen sound enabled', 'info');
    });
  }

  // State
  let activeOrders = [];
  let currentStation = 'all';

  // DOM Elements
  const stationTabs = document.getElementById('stationTabs');
  const btnRefreshKds = document.getElementById('btnRefreshKds');
  const colPendingCards = document.getElementById('colPendingCards');
  const colPreparingCards = document.getElementById('colPreparingCards');
  const colReadyCards = document.getElementById('colReadyCards');

  const badgePendingCount = document.getElementById('badgePendingCount');
  const badgePreparingCount = document.getElementById('badgePreparingCount');
  const badgeReadyCount = document.getElementById('badgeReadyCount');
  const statActiveCount = document.getElementById('statActiveCount');
  const statPendingCount = document.getElementById('statPendingCount');

  // --- Fetch Live Orders ---
  async function fetchLiveOrders() {
    try {
      const res = await fetch('/api/orders/live');
      const data = await res.json();
      if (data.success && data.orders) {
        activeOrders = data.orders;
        renderKanban();
      }
    } catch (err) {
      console.error('KDS Fetch Error:', err);
    }
  }

  // --- Filter Items by Station ---
  function filterItemsByStation(items) {
    if (currentStation === 'all') return items;
    if (currentStation === 'beverage') {
      return items.filter(it => ['hot-beverages', 'mojitos', 'shakes', 'soft-drinks', 'energy-drinks'].includes(it.category));
    }
    if (currentStation === 'kitchen') {
      return items.filter(it => ['snacks', 'icecream', 'beach-services'].includes(it.category));
    }
    return items;
  }

  // --- Render Kanban Board ---
  function renderKanban() {
    colPendingCards.innerHTML = '';
    colPreparingCards.innerHTML = '';
    colReadyCards.innerHTML = '';

    let pendingCount = 0;
    let preparingCount = 0;
    let readyCount = 0;

    activeOrders.forEach(order => {
      const stationItems = filterItemsByStation(order.items);
      if (stationItems.length === 0) return; // Order doesn't have items for this station

      const card = createKotCard(order, stationItems);

      if (order.orderStatus === 'PENDING' || order.orderStatus === 'ACCEPTED') {
        pendingCount++;
        colPendingCards.appendChild(card);
      } else if (order.orderStatus === 'KITCHEN_PREPARING') {
        preparingCount++;
        colPreparingCards.appendChild(card);
      } else if (order.orderStatus === 'READY_FOR_PICKUP') {
        readyCount++;
        colReadyCards.appendChild(card);
      }
    });

    // Update Badges
    badgePendingCount.textContent = pendingCount;
    badgePreparingCount.textContent = preparingCount;
    badgeReadyCount.textContent = readyCount;
    statActiveCount.textContent = activeOrders.length;
    statPendingCount.textContent = pendingCount;

    // Show empty states if columns are clear
    if (pendingCount === 0) {
      colPendingCards.innerHTML = '<div style="text-align: center; color: var(--color-foam); opacity: 0.5; padding: 2rem;">No pending tickets 🌊</div>';
    }
    if (preparingCount === 0) {
      colPreparingCards.innerHTML = '<div style="text-align: center; color: var(--color-foam); opacity: 0.5; padding: 2rem;">No orders currently on burner/bar 🍳</div>';
    }
    if (readyCount === 0) {
      colReadyCards.innerHTML = '<div style="text-align: center; color: var(--color-foam); opacity: 0.5; padding: 2rem;">No plated orders waiting pickup 🛎️</div>';
    }
  }

  // --- Build Ticket Card Component ---
  function createKotCard(order, stationItems) {
    const card = document.createElement('div');
    card.className = 'kot-card';
    card.setAttribute('data-id', order._id);

    const placedDate = new Date(order.timestamps?.placedAt || order.createdAt);
    const timeAgoStr = getTimeAgo(placedDate);

    // Location & Order Type label
    const isTakeaway = order.orderType === 'TAKEAWAY' || (order.locationDetails?.tableNumber || '').toLowerCase().includes('takeaway');
    let locLabel = '🏖️ Beach Service';
    let locBadgeStyle = '';

    if (isTakeaway) {
      locLabel = '🛍️ TAKEAWAY / PACK IN PARCEL';
      locBadgeStyle = 'background: rgba(72, 202, 228, 0.25); color: #48CAE4; border: 1px solid #48CAE4; font-weight: 800;';
    } else if (order.locationDetails?.tableNumber) {
      locLabel = `🪵 ${order.locationDetails.tableNumber}`;
    } else if (order.locationDetails?.beachSpot) {
      locLabel = `🏖️ ${order.locationDetails.beachSpot}`;
    }

    // Build items HTML
    let itemsHtml = '';
    stationItems.forEach(it => {
      itemsHtml += `
        <tr>
          <td class="kot-item-qty">${it.quantity}x</td>
          <td class="kot-item-title">
            <strong>${it.title}</strong>
            ${it.variant ? `<div><span class="kot-item-variant">${it.variant}</span></div>` : ''}
            ${it.specialInstructions ? `<div style="font-size: 0.72rem; color: #FFA585;">* ${it.specialInstructions}</div>` : ''}
          </td>
        </tr>
      `;
    });

    // Action button based on status
    let actionBtnHtml = '';
    if (order.orderStatus === 'PENDING' || order.orderStatus === 'ACCEPTED') {
      actionBtnHtml = `
        <button class="btn-kot-action start" data-id="${order._id}" data-target="KITCHEN_PREPARING">
          ${isTakeaway ? '🍳 Start Preparing Takeaway' : '🍳 Start Brewing & Cooking'}
        </button>
      `;
    } else if (order.orderStatus === 'KITCHEN_PREPARING') {
      actionBtnHtml = `
        <button class="btn-kot-action ready" data-id="${order._id}" data-target="READY_FOR_PICKUP">
          ${isTakeaway ? '📦 Pack Parcel & Mark Ready' : '🛎️ Mark Plated & Ready'}
        </button>
      `;
    } else if (order.orderStatus === 'READY_FOR_PICKUP') {
      actionBtnHtml = `
        <button class="btn-kot-action served" data-id="${order._id}" data-target="SERVED">
          ${isTakeaway ? '🤝 Handed Over to Customer' : '🌊 Served & Delivered to Beach'}
        </button>
      `;
    }

    card.innerHTML = `
      <div class="kot-header-row">
        <div>
          <span class="kot-order-num">${order.orderNumber}</span>
          <div class="kot-location-badge" style="${locBadgeStyle}">${locLabel}</div>
        </div>
        <span class="kot-time-ago" data-time="${placedDate.toISOString()}">${timeAgoStr}</span>
      </div>

      <div style="font-size: 0.75rem; color: var(--color-foam); opacity: 0.85;">
        Guest: <strong>${order.locationDetails?.customerName || 'Beach Guest'}</strong> &bull; Total Items: ${order.totalItemCount}
      </div>

      <table class="kot-items-table">
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>

      ${order.kitchenNotes ? `<div style="font-size: 0.75rem; background: rgba(238,108,77,0.15); padding: 0.35rem 0.5rem; border-radius: 4px; color: #FFA585;">Note: ${order.kitchenNotes}</div>` : ''}

      ${actionBtnHtml}
    `;

    // Button event
    const actionBtn = card.querySelector('.btn-kot-action');
    if (actionBtn) {
      actionBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const targetStatus = actionBtn.getAttribute('data-target');
        const orderId = actionBtn.getAttribute('data-id');
        await updateStatus(orderId, targetStatus);
      });
    }

    return card;
  }

  // --- Update Order Status ---
  async function updateStatus(orderId, nextStatus) {
    try {
      const res = await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      });

      const data = await res.json();
      if (data.success) {
        if (nextStatus === 'READY_FOR_PICKUP') {
          soundEngine.playOrderReadyBell();
          showToast(`🛎️ Ticket ${data.order.orderNumber} marked READY!`, 'success');
        } else if (nextStatus === 'SERVED') {
          showToast(`🌊 Ticket ${data.order.orderNumber} served!`, 'info');
        } else {
          showToast(`🍳 Ticket ${data.order.orderNumber} in prep`, 'warning');
        }
        await fetchLiveOrders();
      }
    } catch (err) {
      showToast(`Error: ${err.message}`, 'danger');
    }
  }

  // --- Helper: Relative Time Ago ---
  function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ${seconds % 60}s ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m ago`;
  }

  // Real-time ticker for elapsed time tags
  setInterval(() => {
    document.querySelectorAll('.kot-time-ago').forEach(el => {
      const timeIso = el.getAttribute('data-time');
      if (timeIso) {
        el.textContent = getTimeAgo(new Date(timeIso));
      }
    });
  }, 1000);

  // --- Station Filter Tabs ---
  stationTabs.addEventListener('click', (e) => {
    const btn = e.target.closest('.station-btn');
    if (!btn) return;
    document.querySelectorAll('.station-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentStation = btn.getAttribute('data-station');
    renderKanban();
  });

  btnRefreshKds.addEventListener('click', fetchLiveOrders);

  // --- Socket.IO Real-time Events ---
  if (socket) {
    socket.on('order:created', (data) => {
      soundEngine.playNewOrderChime();
      showToast(`🔥 New Beach Order: ${data.order.orderNumber}!`, 'danger');
      fetchLiveOrders();
    });

    socket.on('kot:status_change', () => {
      fetchLiveOrders();
    });

    socket.on('sound:kitchen_alert', (data) => {
      if (data.soundType === 'new_order') {
        soundEngine.playNewOrderChime();
      } else if (data.soundType === 'order_ready') {
        soundEngine.playOrderReadyBell();
      }
    });
  }

  // --- Toast Notification Helper ---
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

  // Initial load & periodic poll fallback
  fetchLiveOrders();
  setInterval(fetchLiveOrders, 8000);
});
