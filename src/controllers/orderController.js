const Order = require('../models/Order');
const { emitOrderCreated, emitStatusChange } = require('../sockets/socketHandler');
const { syncOrderToOracle, syncPaymentToOracle } = require('../services/oracleSyncService');
const mongoose = require('mongoose');

// Resilient in-memory storage fallback when persistent cloud DB is connecting or disconnected
const inMemoryOrders = [];
let inMemoryTableCount = 9;

/**
 * Generate sequential order number for today (e.g. AC-20261022-0001)
 */
async function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;

  let countToday = 0;
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const startOfDay = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59);
      countToday = await Order.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      });
    } catch (e) {
      countToday = inMemoryOrders.length;
    }
  } else {
    countToday = inMemoryOrders.length;
  }

  const sequence = countToday + 1;
  const formattedSeq = String(sequence).padStart(4, '0');
  const orderNumber = `AC-${datePrefix}-${formattedSeq}`;

  return { orderNumber, sequence };
}

/**
 * Create a new order (from POS Waiter or Cashier Counter)
 */
async function createOrder(req, res) {
  try {
    const {
      orderType = 'DINE_IN',
      locationDetails = {},
      items = [],
      discountAmount = 0,
      paymentMethod = 'UPI_QR',
      paymentStatus = 'UNPAID',
      cashierUser = 'Cashier Counter 1',
      kitchenNotes = ''
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'Order must contain at least one item' });
    }

    const { orderNumber, sequence } = await generateOrderNumber();

    // Check if tableNumber is active and append requested
    const targetTable = locationDetails.tableNumber;
    const { appendToExisting = false } = req.body;

    // Calculate subtotals
    let subtotalAmount = 0;
    let totalItemCount = 0;

    const validatedItems = items.map(item => {
      const quantity = Math.max(1, Number(item.quantity) || 1);
      const unitPrice = Number(item.unitPrice) || 0;
      const subtotal = unitPrice * quantity;
      subtotalAmount += subtotal;
      totalItemCount += quantity;

      return {
        menuItemId: item.menuItemId || null,
        sku: item.sku || '',
        title: item.title,
        category: item.category,
        variant: item.variant || null,
        unitPrice,
        quantity,
        subtotal,
        specialInstructions: item.specialInstructions || ''
      };
    });

    // Check if tableNumber is active and append requested (or auto-append if table is already active)
    let existingOrder = null;
    if (targetTable && targetTable !== 'Takeaway') {
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          existingOrder = await Order.findOne({
            'locationDetails.tableNumber': targetTable,
            paymentStatus: { $ne: 'PAID' },
            orderStatus: { $ne: 'CANCELLED' }
          });
        } catch (e) {}
      }
      if (!existingOrder) {
        existingOrder = inMemoryOrders.find(o => {
          const tbl = (o.locationDetails?.tableNumber || '').trim().toLowerCase();
          return tbl === targetTable.toLowerCase() && 
                 o.paymentStatus !== 'PAID' && 
                 o.orderStatus !== 'CANCELLED';
        });
      }
    }

    if (existingOrder) {
      // Append or merge new items
      validatedItems.forEach(it => {
        const matchIdx = existingOrder.items.findIndex(existing => 
          existing.title === it.title && existing.variant === it.variant
        );
        if (matchIdx > -1) {
          existingOrder.items[matchIdx].quantity += it.quantity;
          existingOrder.items[matchIdx].subtotal = existingOrder.items[matchIdx].quantity * existingOrder.items[matchIdx].unitPrice;
        } else {
          existingOrder.items.push(it);
        }
      });

      // Recalculate bill totals
      existingOrder.totalItemCount = existingOrder.items.reduce((sum, it) => sum + (it.quantity || 1), 0);
      existingOrder.subtotalAmount = existingOrder.items.reduce((sum, it) => sum + (it.subtotal || (it.unitPrice * it.quantity)), 0);
      const discount = Number(existingOrder.discountAmount) || 0;
      existingOrder.finalTotalAmount = Math.max(0, existingOrder.subtotalAmount - discount);
      if (kitchenNotes) {
        existingOrder.kitchenNotes = existingOrder.kitchenNotes ? `${existingOrder.kitchenNotes} | ${kitchenNotes}` : kitchenNotes;
      }
      existingOrder.orderStatus = 'PENDING'; // Notify kitchen for the newly added items

      let updatedOrder = existingOrder;
      if (mongoose.connection && mongoose.connection.readyState === 1 && typeof existingOrder.save === 'function') {
        try {
          updatedOrder = await existingOrder.save();
        } catch (err) {}
      }

      emitOrderCreated(updatedOrder);
      syncOrderToOracle(updatedOrder).catch(() => {});

      return res.status(200).json({
        success: true,
        message: `Added ${validatedItems.length} new item(s) to ${targetTable} running order (${updatedOrder.orderNumber})! Total: ₹${updatedOrder.finalTotalAmount}`,
        order: updatedOrder
      });
    }

    const finalTotalAmount = Math.max(0, subtotalAmount - (Number(discountAmount) || 0));

    const newOrder = new Order({
      orderNumber,
      dailySequence: sequence,
      orderType,
      locationDetails: {
        tableNumber: locationDetails.tableNumber || '',
        beachSpot: locationDetails.beachSpot || '',
        customerName: locationDetails.customerName || 'Beach Guest',
        customerPhone: locationDetails.customerPhone || ''
      },
      items: validatedItems,
      totalItemCount,
      subtotalAmount,
      discountAmount: Number(discountAmount) || 0,
      finalTotalAmount,
      orderStatus: 'PENDING',
      paymentStatus,
      paymentMethod,
      timestamps: {
        placedAt: new Date()
      },
      cashierUser,
      kitchenNotes
    });

    let savedOrder;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        savedOrder = await newOrder.save();
      } catch (saveErr) {
        savedOrder = newOrder.toObject ? newOrder.toObject() : newOrder;
        savedOrder._id = savedOrder._id || orderNumber;
        inMemoryOrders.push(savedOrder);
      }
    } else {
      savedOrder = newOrder.toObject ? newOrder.toObject() : newOrder;
      savedOrder._id = savedOrder._id || orderNumber;
      inMemoryOrders.push(savedOrder);
    }
    syncOrderToOracle(savedOrder).catch(() => {});

    // If order was marked as PAID immediately at checkout, record payment transaction
    if (paymentStatus === 'PAID') {
      try {
        const Payment = require('../models/Payment');
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const paymentTransactionId = `TXN-${year}${month}${day}-${randomSuffix}`;

        const payment = new Payment({
          paymentTransactionId,
          orderId: savedOrder._id,
          orderNumber: savedOrder.orderNumber,
          amountReceived: savedOrder.finalTotalAmount,
          paymentMethod: paymentMethod || 'PHONEPE',
          cashTendered: savedOrder.finalTotalAmount,
          changeReturned: 0,
          status: 'SUCCESS',
          processedBy: cashierUser || 'Counter 1'
        });

        if (mongoose.connection && mongoose.connection.readyState === 1) {
          try { await payment.save(); } catch (pErr) {}
        }
        syncPaymentToOracle(payment).catch(() => {});

        const { emitPaymentRecorded } = require('../sockets/socketHandler');
        emitPaymentRecorded(payment, savedOrder);
      } catch (payErr) {
        console.error('Error creating payment record:', payErr);
      }
    }

    // Broadcast to kitchen and POS displays via WebSocket
    emitOrderCreated(savedOrder);

    res.status(201).json({
      success: true,
      message: `Order ${savedOrder.orderNumber} placed successfully!`,
      order: savedOrder
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Fetch live active orders for KOT and POS boards
 */
async function getLiveOrders(req, res) {
  try {
    const liveStatuses = ['PENDING', 'ACCEPTED', 'KITCHEN_PREPARING', 'READY_FOR_PICKUP'];
    const orders = await Order.find({ orderStatus: { $in: liveStatuses } })
      .sort({ createdAt: 1 });

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Fetch all orders with query filters
 */
async function getAllOrders(req, res) {
  try {
    const { status, limit = 50, date, orderType } = req.query;
    const filter = {};

    if (status) filter.orderStatus = status;
    if (orderType) filter.orderType = orderType;

    if (date) {
      const d = new Date(date);
      const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      filter.createdAt = { $gte: start, $lte: end };
    }

    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    res.json({
      success: true,
      count: orders.length,
      orders
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Public customer live tracking by order number (e.g. AC-20261022-0042)
 */
async function trackOrderByNumber(req, res) {
  try {
    const { orderNumber } = req.params;
    const order = await Order.findOne({ orderNumber });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: `Order with number "${orderNumber}" not found`
      });
    }

    // Determine current progression step (1 to 4)
    let step = 1;
    let stepTitle = 'Order Confirmed & Sent to Kitchen';
    let estimatedMinutes = 15;

    switch (order.orderStatus) {
      case 'PENDING':
      case 'ACCEPTED':
        step = 1;
        stepTitle = 'Order Received & In Queue';
        estimatedMinutes = 15;
        break;
      case 'KITCHEN_PREPARING':
        step = 2;
        stepTitle = 'Kitchen Brewing & Frying';
        estimatedMinutes = 8;
        break;
      case 'READY_FOR_PICKUP':
        step = 3;
        stepTitle = 'Quality Plated & Ready for Service';
        estimatedMinutes = 1;
        break;
      case 'SERVED':
        step = 4;
        stepTitle = 'Delivered to Beach Table / Handed Over';
        estimatedMinutes = 0;
        break;
      case 'CANCELLED':
        step = 0;
        stepTitle = 'Order Cancelled';
        estimatedMinutes = 0;
        break;
    }

    res.json({
      success: true,
      orderNumber: order.orderNumber,
      orderType: order.orderType,
      locationDetails: order.locationDetails,
      orderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      totalAmount: order.finalTotalAmount,
      totalItemCount: order.totalItemCount,
      step,
      stepTitle,
      estimatedMinutes,
      items: order.items.map(it => ({
        title: it.title,
        variant: it.variant,
        quantity: it.quantity,
        subtotal: it.subtotal
      })),
      timestamps: order.timestamps,
      cafeSupportPhone: '7702897213',
      cafeSupportWhatsAppUrl: 'https://wa.me/917702897213?text=' + encodeURIComponent(`Hello Anchor Cafe! Checking status for order ${order.orderNumber}`)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Update order status (KOT Kanban drag & drop or button click)
 */
async function updateOrderStatus(req, res) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const validStatuses = ['PENDING', 'ACCEPTED', 'KITCHEN_PREPARING', 'READY_FOR_PICKUP', 'SERVED', 'CANCELLED'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: `Invalid status "${status}"` });
    }

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    order.orderStatus = status;

    // Update timestamps accordingly
    const now = new Date();
    if (!order.timestamps) order.timestamps = {};

    if (status === 'ACCEPTED' && !order.timestamps.acceptedAt) {
      order.timestamps.acceptedAt = now;
    } else if (status === 'KITCHEN_PREPARING' && !order.timestamps.kitchenStartedAt) {
      order.timestamps.kitchenStartedAt = now;
    } else if (status === 'READY_FOR_PICKUP' && !order.timestamps.readyAt) {
      order.timestamps.readyAt = now;
    } else if (status === 'SERVED' && !order.timestamps.completedAt) {
      order.timestamps.completedAt = now;
    }

    const saved = await order.save();
    syncOrderToOracle(saved).catch(() => {});

    // Broadcast status change to kitchen and live tracking views
    emitStatusChange(saved);

    res.json({
      success: true,
      message: `Order ${order.orderNumber} updated to ${status}`,
      order: saved
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

const CafeSetting = require('../models/CafeSetting');

async function getConfiguredTableCount() {
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const setting = await CafeSetting.findOne({ key: 'table_count' });
      if (setting && typeof setting.value === 'number' && setting.value > 0) {
        return setting.value;
      }
    } catch (err) {
      console.error('Error reading table_count setting:', err);
    }
  }
  return inMemoryTableCount || 9; // Default 9 tables
}

/**
 * Increase dining tables count (e.g. 9 -> 10)
 */
async function increaseTableCount(req, res) {
  try {
    let currentCount = await getConfiguredTableCount();
    if (currentCount >= 50) {
      return res.status(400).json({ success: false, message: 'Maximum table limit (50) reached.' });
    }
    const newCount = currentCount + 1;
    inMemoryTableCount = newCount;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        await CafeSetting.findOneAndUpdate(
          { key: 'table_count' },
          { key: 'table_count', value: newCount, description: 'Active dining tables capacity' },
          { upsert: true, new: true }
        );
      } catch (e) {}
    }

    const { getIO } = require('../sockets/socketHandler');
    const io = getIO();
    if (io) {
      io.emit('tables:count_updated', { totalTables: newCount });
    }

    res.json({
      success: true,
      message: `Table count increased to ${newCount} (Added Table ${newCount})`,
      totalTables: newCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Decrease dining tables count (e.g. 10 -> 9)
 * Checks if the highest table has an active unpaid bill before removing!
 */
async function decreaseTableCount(req, res) {
  try {
    let currentCount = await getConfiguredTableCount();
    if (currentCount <= 1) {
      return res.status(400).json({ success: false, message: 'Minimum table limit is 1.' });
    }

    // Check if highest table is currently occupied
    const highestTableLabel = `Table ${currentCount}`;
    let activeOrders = inMemoryOrders;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        activeOrders = await Order.find({
          paymentStatus: { $ne: 'PAID' },
          orderStatus: { $ne: 'CANCELLED' }
        });
      } catch (e) {}
    }

    const activeOrderOnHighest = activeOrders.find(o => {
      const tbl = (o.locationDetails?.tableNumber || '').trim().toLowerCase();
      return tbl === highestTableLabel.toLowerCase() || 
             tbl === `t${currentCount}` || 
             tbl === `table 0${currentCount}` || 
             tbl === `${currentCount}`;
    });

    if (activeOrderOnHighest) {
      return res.status(400).json({
        success: false,
        message: `Cannot remove ${highestTableLabel} because it has an active bill (${activeOrderOnHighest.orderNumber})! Settle or clear it first.`
      });
    }

    const newCount = currentCount - 1;
    inMemoryTableCount = newCount;

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        await CafeSetting.findOneAndUpdate(
          { key: 'table_count' },
          { key: 'table_count', value: newCount, description: 'Active dining tables capacity' },
          { upsert: true, new: true }
        );
      } catch (e) {}
    }

    const { getIO } = require('../sockets/socketHandler');
    const io = getIO();
    if (io) {
      io.emit('tables:count_updated', { totalTables: newCount });
    }

    res.json({
      success: true,
      message: `Table count decreased to ${newCount} (Removed ${highestTableLabel})`,
      totalTables: newCount
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get live status and active orders for all Tables + Active Takeaways
 */
async function getTablesOverview(req, res) {
  try {
    const totalTables = await getConfiguredTableCount();
    let activeOrders = [];

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        activeOrders = await Order.find({
          $and: [
            { orderStatus: { $ne: 'CANCELLED' } },
            {
              $or: [
                { paymentStatus: { $ne: 'PAID' } },
                { orderStatus: { $ne: 'SERVED' } }
              ]
            }
          ]
        }).sort({ createdAt: -1 });
      } catch (e) {
        activeOrders = inMemoryOrders.filter(o => o.orderStatus !== 'CANCELLED' && (o.paymentStatus !== 'PAID' || o.orderStatus !== 'SERVED'));
      }
    } else {
      activeOrders = inMemoryOrders.filter(o => o.orderStatus !== 'CANCELLED' && (o.paymentStatus !== 'PAID' || o.orderStatus !== 'SERVED'));
    }

    const tables = [];
    for (let i = 1; i <= totalTables; i++) {
      const tableLabel = `Table ${i}`;
      // Match variants like "Table 1", "T1", "Table 01"
      const activeOrder = activeOrders.find(o => {
        const tbl = (o.locationDetails?.tableNumber || '').trim().toLowerCase();
        return tbl === tableLabel.toLowerCase() || 
               tbl === `t${i}` || 
               tbl === `table 0${i}` || 
               tbl === `${i}`;
      });

      tables.push({
        tableNumber: tableLabel,
        tableId: i,
        isOccupied: !!activeOrder,
        order: activeOrder || null
      });
    }

    // Active Takeaway Orders
    const activeTakeaways = activeOrders.filter(o => {
      const tbl = (o.locationDetails?.tableNumber || '').trim().toLowerCase();
      return o.orderType === 'TAKEAWAY' || tbl.includes('takeaway') || tbl.includes('pickup') || tbl === 'pick';
    });

    res.json({
      success: true,
      totalTables,
      tables,
      activeTakeaways
    });
  } catch (error) {
    res.json({
      success: true,
      totalTables: 9,
      tables: Array.from({ length: 9 }, (_, i) => ({
        tableNumber: `Table ${i + 1}`,
        tableId: i + 1,
        isOccupied: false,
        order: null
      })),
      activeTakeaways: []
    });
  }
}

/**
 * Direct 1-tap table payment settlement (PhonePe, GPay, Cash, Card)
 * Ticks payment as complete, updates order to PAID, and frees up table.
 */
async function settleTablePayment(req, res) {
  try {
    const { orderId, paymentMethod = 'PHONEPE', cashTendered = 0, changeReturned = 0, notes = '' } = req.body;
    let order = null;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        order = await Order.findById(orderId);
      } catch (e) {}
    }
    if (!order) {
      order = inMemoryOrders.find(o => String(o._id) === String(orderId) || o.orderNumber === orderId);
    }
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const Payment = require('../models/Payment');
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const paymentTransactionId = `TXN-${year}${month}${day}-${randomSuffix}`;

    const payment = new Payment({
      paymentTransactionId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      amountReceived: order.finalTotalAmount,
      paymentMethod,
      cashTendered: Number(cashTendered) || order.finalTotalAmount,
      changeReturned: Number(changeReturned) || 0,
      status: 'SUCCESS',
      processedBy: 'Counter 1'
    });

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try { await payment.save(); } catch (e) {}
    }
    syncPaymentToOracle(payment).catch(() => {});

    order.paymentStatus = 'PAID';
    order.paymentMethod = paymentMethod.includes('CASH') ? 'CASH' : (paymentMethod.includes('CARD') ? 'CARD' : 'UPI_QR');
    order.orderStatus = 'SERVED';
    if (!order.timestamps) order.timestamps = {};
    order.timestamps.completedAt = new Date();

    if (mongoose.connection && mongoose.connection.readyState === 1 && typeof order.save === 'function') {
      try { await order.save(); } catch (e) {}
    }
    syncOrderToOracle(order).catch(() => {});

    const { emitPaymentRecorded, emitStatusChange } = require('../sockets/socketHandler');
    emitPaymentRecorded(payment, order);
    emitStatusChange(order);

    res.json({
      success: true,
      message: `Table order ${order.orderNumber} settled successfully via ${paymentMethod}! Table is now available.`,
      order,
      payment
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  createOrder,
  getLiveOrders,
  getAllOrders,
  trackOrderByNumber,
  updateOrderStatus,
  getTablesOverview,
  settleTablePayment,
  increaseTableCount,
  decreaseTableCount
};
