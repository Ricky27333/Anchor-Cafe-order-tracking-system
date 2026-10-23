let ioInstance = null;

function initSocket(io) {
  ioInstance = io;

  io.on('connection', (socket) => {
    console.log(`🔌 [Socket.IO] New client connected: ${socket.id}`);

    // Join room if requested (e.g. 'kitchen', 'cashier', 'track-AC-...')
    socket.on('join:room', (room) => {
      socket.join(room);
      console.log(`📡 [Socket.IO] Client ${socket.id} joined room: ${room}`);
    });

    // Kitchen acknowledging an order
    socket.on('kot:acknowledge', (data) => {
      socket.broadcast.emit('kot:acknowledged', data);
    });

    // Sound alert trigger
    socket.on('sound:trigger', (data) => {
      io.emit('sound:kitchen_alert', data || { soundType: 'chime' });
    });

    socket.on('disconnect', () => {
      console.log(`🔌 [Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return ioInstance;
}

function getIO() {
  return ioInstance;
}

// Helper broadcasters
function emitOrderCreated(order) {
  if (ioInstance) {
    ioInstance.emit('order:created', { order });
    ioInstance.emit('sound:kitchen_alert', { 
      soundType: 'new_order',
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      itemCount: order.totalItemCount
    });
    console.log(`📢 [Socket.IO] Emitted order:created for ${order.orderNumber}`);
  }
}

function emitStatusChange(order) {
  if (ioInstance) {
    ioInstance.emit('kot:status_change', { 
      orderId: order._id,
      orderNumber: order.orderNumber,
      status: order.orderStatus,
      readyAt: order.timestamps?.readyAt,
      order
    });
    // If ready, trigger chime sound
    if (order.orderStatus === 'READY_FOR_PICKUP') {
      ioInstance.emit('sound:kitchen_alert', {
        soundType: 'order_ready',
        orderNumber: order.orderNumber,
        tableNumber: order.locationDetails?.tableNumber || order.locationDetails?.beachSpot
      });
    }
    console.log(`📢 [Socket.IO] Emitted kot:status_change for ${order.orderNumber} -> ${order.orderStatus}`);
  }
}

function emitPaymentRecorded(payment, order) {
  if (ioInstance) {
    ioInstance.emit('payment:recorded', { 
      orderId: order ? order._id : payment.orderId,
      orderNumber: payment.orderNumber,
      payment
    });
    console.log(`📢 [Socket.IO] Emitted payment:recorded for ${payment.orderNumber} (₹${payment.amountReceived})`);
  }
}

module.exports = {
  initSocket,
  getIO,
  emitOrderCreated,
  emitStatusChange,
  emitPaymentRecorded
};
