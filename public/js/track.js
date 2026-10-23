/**
 * AnchorTrack Customer Live Order Tracker Logic
 * Real-time 4-step coastal stepper updates, dynamic ETA calculation,
 * and direct WhatsApp communication with Anchor Cafe reception.
 */

document.addEventListener('DOMContentLoaded', () => {
  const socket = typeof io !== 'undefined' ? io() : null;
  const soundEngine = window.soundEngine;

  const orderInput = document.getElementById('orderInput');
  const btnTrackOrder = document.getElementById('btnTrackOrder');
  const trackingView = document.getElementById('trackingView');
  const trackerEmptyState = document.getElementById('trackerEmptyState');

  const displayOrderNum = document.getElementById('displayOrderNum');
  const displayLocation = document.getElementById('displayLocation');
  const displayEstimatedTime = document.getElementById('displayEstimatedTime');
  const displayItemsTable = document.getElementById('displayItemsTable');
  const displayTotalAmount = document.getElementById('displayTotalAmount');
  const btnWhatsAppHelp = document.getElementById('btnWhatsAppHelp');

  const stepNode1 = document.getElementById('stepNode1');
  const stepNode2 = document.getElementById('stepNode2');
  const stepNode3 = document.getElementById('stepNode3');
  const stepNode4 = document.getElementById('stepNode4');
  const stepNodes = [stepNode1, stepNode2, stepNode3, stepNode4];

  let currentTrackedOrder = '';

  // Extract from query param or path
  function getInitialOrderNumber() {
    const params = new URLSearchParams(window.location.search);
    if (params.has('order')) return params.get('order');

    const pathParts = window.location.pathname.split('/');
    if (pathParts.length >= 3 && pathParts[1] === 'track') {
      return pathParts[2];
    }
    return '';
  }

  async function trackOrder(orderNum) {
    if (!orderNum) return;
    const cleanNum = orderNum.trim().toUpperCase();
    currentTrackedOrder = cleanNum;

    try {
      btnTrackOrder.disabled = true;
      btnTrackOrder.textContent = 'Searching...';

      const res = await fetch(`/api/orders/track/${cleanNum}`);
      const data = await res.json();

      if (data.success) {
        renderOrderData(data);
        orderInput.value = cleanNum;
        trackerEmptyState.style.display = 'none';
        trackingView.style.display = 'block';

        // Join room in socket if available
        if (socket) {
          socket.emit('join:room', `track-${cleanNum}`);
        }
      } else {
        alert(data.message || `Order ${cleanNum} not found`);
      }
    } catch (err) {
      console.error('Tracking Error:', err);
      alert('Could not fetch order status. Please check your connection.');
    } finally {
      btnTrackOrder.disabled = false;
      btnTrackOrder.textContent = 'Track Order';
    }
  }

  function renderOrderData(data) {
    displayOrderNum.textContent = data.orderNumber;

    let locText = 'Ramapuram Beach Sand Service';
    if (data.locationDetails?.tableNumber) {
      locText = `Deck Table: ${data.locationDetails.tableNumber}`;
    } else if (data.locationDetails?.beachSpot) {
      locText = `Beach Lounger: ${data.locationDetails.beachSpot}`;
    }
    displayLocation.textContent = `Delivering to: ${locText} (${data.locationDetails?.customerName || 'Beach Guest'})`;

    if (data.step >= 4) {
      displayEstimatedTime.textContent = '✅ Delivered!';
      displayEstimatedTime.style.background = 'rgba(42, 157, 143, 0.3)';
    } else if (data.step === 3) {
      displayEstimatedTime.textContent = '🛎️ Plated & En Route!';
    } else if (data.estimatedMinutes > 0) {
      displayEstimatedTime.textContent = `Est. ~${data.estimatedMinutes} mins`;
    } else {
      displayEstimatedTime.textContent = data.stepTitle;
    }

    displayTotalAmount.textContent = `₹${data.totalAmount}`;

    // Update 4-step stepper
    const currentStep = data.step; // 1, 2, 3, or 4
    stepNodes.forEach((node, idx) => {
      const stepIdx = idx + 1;
      node.classList.remove('active', 'completed');

      if (stepIdx < currentStep) {
        node.classList.add('completed');
      } else if (stepIdx === currentStep) {
        node.classList.add('active');
      }
    });

    // Populate Items
    displayItemsTable.innerHTML = '';
    data.items.forEach(it => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td style="width: 32px; font-weight: 700; color: var(--color-gold);">${it.quantity}x</td>
        <td>
          <div style="font-weight: 600; color: var(--color-sand);">${it.title}</div>
          ${it.variant ? `<small style="color: var(--color-gold);">${it.variant}</small>` : ''}
        </td>
        <td style="text-align: right; font-weight: 700; color: var(--color-gold);">₹${it.subtotal}</td>
      `;
      displayItemsTable.appendChild(row);
    });

    // Update WhatsApp link
    const waText = encodeURIComponent(`Hello Anchor Cafe Reception! Checking on order ${data.orderNumber} at Ramapuram Beach.`);
    btnWhatsAppHelp.href = `https://wa.me/917702897213?text=${waText}`;
  }

  btnTrackOrder.addEventListener('click', () => {
    trackOrder(orderInput.value);
  });

  orderInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') trackOrder(orderInput.value);
  });

  // Socket.IO updates for live status changes
  if (socket) {
    socket.on('kot:status_change', (data) => {
      if (currentTrackedOrder && data.orderNumber === currentTrackedOrder) {
        soundEngine.playOrderReadyBell();
        trackOrder(currentTrackedOrder);
      }
    });
  }

  // Initialize from URL
  const initialOrder = getInitialOrderNumber();
  if (initialOrder) {
    trackOrder(initialOrder);
  }
});
