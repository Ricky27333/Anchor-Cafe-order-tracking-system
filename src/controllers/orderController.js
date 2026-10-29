const Order = require('../models/Order');
const { emitOrderCreated, emitStatusChange } = require('../sockets/socketHandler');
const { syncOrderToOracle, syncPaymentToOracle } = require('../services/oracleSyncService');
const localDataStore = require('../services/localDataStore');
const mongoose = require('mongoose');

/**
 * Generate sequential order number for today (e.g. AC-20261022-0001)
 */
async function generateOrderNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const datePrefix = `${year}${month}${day}`;

  let sequence = 1;
  if (mongoose.connection && mongoose.connection.readyState === 1) {
    try {
      const startOfDay = new Date(year, now.getMonth(), now.getDate(), 0, 0, 0);
      const endOfDay = new Date(year, now.getMonth(), now.getDate(), 23, 59, 59);
      const countToday = await Order.countDocuments({
        createdAt: { $gte: startOfDay, $lte: endOfDay }
      }).maxTimeMS(1000);
      sequence = countToday + 1;
    } catch (e) {
      sequence = localDataStore.getOrders().length + 1;
    }
  } else {
    sequence = localDataStore.getOrders().length + 1;
  }

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

    let orderNumber, sequence;
    try {
      const numRes = await generateOrderNumber();
      orderNumber = numRes.orderNumber;
      sequence = numRes.sequence;
    } catch (numErr) {
      const now = new Date();
      const datePrefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
      sequence = localDataStore.getOrders().length + 1;
      orderNumber = `AC-${datePrefix}-${String(sequence).padStart(4, '0')}`;
    }

    // Check if tableNumber is active and append items to running tab
    const targetTable = locationDetails.tableNumber;
    const shouldAppend = (req.body.appendToExisting !== false) && (targetTable && targetTable.toLowerCase() !== 'takeaway');

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

    if (targetTable && shouldAppend) {
      let existingOrder = null;
      if (mongoose.connection && mongoose.connection.readyState === 1) {
        try {
          const tableRegex = new RegExp(`^${targetTable.trim()}$`, 'i');
          existingOrder = await Order.findOne({
            'locationDetails.tableNumber': { $regex: tableRegex },
            paymentStatus: { $ne: 'PAID' },
            orderStatus: { $ne: 'CANCELLED' }
          }).maxTimeMS(1200);
        } catch (e) {
          existingOrder = null;
        }
      }

      if (!existingOrder) {
        const localActive = localDataStore.getActiveOrdersForTable(targetTable);
        if (localActive.length > 0) {
          existingOrder = localActive[0];
        }
      }

      if (existingOrder) {
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

        // Recalculate full order totals
        let newSubtotal = 0;
        let newItemCount = 0;
        existingOrder.items.forEach(it => {
          newSubtotal += (it.subtotal || (it.unitPrice * it.quantity));
          newItemCount += (Number(it.quantity) || 1);
        });

        existingOrder.subtotalAmount = newSubtotal;
        existingOrder.totalItemCount = newItemCount;
        existingOrder.finalTotalAmount = Math.max(0, newSubtotal - (Number(existingOrder.discountAmount) || 0));

        if (paymentStatus === 'PAID') {
          existingOrder.paymentStatus = 'PAID';
          existingOrder.paymentMethod = paymentMethod;
        }

        let updatedOrder = existingOrder;
        if (existingOrder.save) {
          try {
            updatedOrder = await existingOrder.save();
          } catch (e) {}
        }
        // Always persist to localDataStore
        localDataStore.saveOrder(updatedOrder.toObject ? updatedOrder.toObject() : updatedOrder);

        emitOrderCreated(updatedOrder);
        syncOrderToOracle(updatedOrder).catch(() => {});

        return res.status(200).json({
          success: true,
          message: `Added items to ${targetTable} running order (${updatedOrder.orderNumber})! New Total: ₹${updatedOrder.finalTotalAmount}`,
          order: updatedOrder
        });
      }
    }

    const finalTotalAmount = Math.max(0, subtotalAmount - (Number(discountAmount) || 0));

    const orderData = {
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
      kitchenNotes,
      createdAt: new Date().toISOString()
    };

    let savedOrder = orderData;
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const newOrder = new Order(orderData);
        savedOrder = await newOrder.save();
      } catch (e) {
        console.warn('⚠️ Mongoose save failed, using local store fallback:', e.message);
      }
    }

    // Always persist to fail-safe storage
    localDataStore.saveOrder(savedOrder.toObject ? savedOrder.toObject() : savedOrder);
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

        const validMethods = ['CASH', 'PHONEPE', 'GPAY', 'PAYTM', 'UPI', 'UPI_PHONEPE', 'UPI_GPAY', 'UPI_PAYTM', 'UPI_QR', 'POS_CARD', 'CARD', 'CUSTOMER_TAB'];
        let normMethod = String(paymentMethod || 'PHONEPE').toUpperCase().trim();
        if (normMethod === 'GOOGLEPAY') normMethod = 'GPAY';
        const finalPaymentMethod = validMethods.includes(normMethod) ? normMethod : 'PHONEPE';

        const paymentData = {
          paymentTransactionId,
          orderId: savedOrder._id,
          orderNumber: savedOrder.orderNumber,
          amountReceived: savedOrder.finalTotalAmount,
          paymentMethod: finalPaymentMethod,
          cashTendered: savedOrder.finalTotalAmount,
          changeReturned: 0,
          status: 'SUCCESS',
          processedBy: cashierUser || 'Counter 1'
        };

        if (mongoose.connection && mongoose.connection.readyState === 1) {
          try {
            const payment = new Payment(paymentData);
            await payment.save();
            syncPaymentToOracle(payment).catch(() => {});
            const { emitPaymentRecorded } = require('../sockets/socketHandler');
            emitPaymentRecorded(payment, savedOrder);
          } catch (payErr) {}
        }
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
  try {
    const mongoose = require('mongoose');
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const setting = await CafeSetting.findOne({ key: 'table_count' }).maxTimeMS(1000);
      if (setting && typeof setting.value === 'number' && setting.value > 0) {
        return setting.value;
      }
    }
  } catch (err) {
    // Fall back to default
  }
  return 9; // Default 9 tables
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
    await CafeSetting.findOneAndUpdate(
      { key: 'table_count' },
      { key: 'table_count', value: newCount, description: 'Active dining tables capacity' },
      { upsert: true, new: true }
    );

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
    const activeOrders = await Order.find({
      paymentStatus: { $ne: 'PAID' },
      orderStatus: { $ne: 'CANCELLED' }
    });

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
    await CafeSetting.findOneAndUpdate(
      { key: 'table_count' },
      { key: 'table_count', value: newCount, description: 'Active dining tables capacity' },
      { upsert: true, new: true }
    );

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
        }).sort({ createdAt: -1 }).maxTimeMS(1200);
      } catch (findErr) {
        activeOrders = [];
      }
    }

    // Merge with localDataStore active orders so no table order is ever lost
    const localActive = localDataStore.getOrders().filter(o => 
      o.orderStatus !== 'CANCELLED' && (o.paymentStatus !== 'PAID' || o.orderStatus !== 'SERVED')
    );

    const mergedOrdersMap = new Map();
    activeOrders.forEach(o => mergedOrdersMap.set(o.orderNumber, o));
    localActive.forEach(o => {
      if (!mergedOrdersMap.has(o.orderNumber)) mergedOrdersMap.set(o.orderNumber, o);
    });

    const combinedActiveOrders = Array.from(mergedOrdersMap.values());

    const tables = [];
    for (let i = 1; i <= totalTables; i++) {
      const tableLabel = `Table ${i}`;
      // Match variants like "Table 1", "T1", "Table 01"
      const activeOrder = combinedActiveOrders.find(o => {
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
    const activeTakeaways = combinedActiveOrders.filter(o => {
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
    res.status(500).json({ success: false, message: error.message });
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
        order = await Order.findById(orderId).maxTimeMS(1200);
      } catch (e) {}
    }

    if (!order) {
      order = localDataStore.getOrderById(orderId);
    }

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const paymentTransactionId = `TXN-${year}${month}${day}-${randomSuffix}`;

    const validMethods = ['CASH', 'PHONEPE', 'GPAY', 'PAYTM', 'UPI', 'UPI_PHONEPE', 'UPI_GPAY', 'UPI_PAYTM', 'UPI_QR', 'POS_CARD', 'CARD', 'CUSTOMER_TAB'];
    let normMethod = String(paymentMethod || 'PHONEPE').toUpperCase().trim();
    if (normMethod === 'GOOGLEPAY') normMethod = 'GPAY';
    const finalPaymentMethod = validMethods.includes(normMethod) ? normMethod : 'PHONEPE';

    const paymentData = {
      paymentTransactionId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      amountReceived: order.finalTotalAmount,
      paymentMethod: finalPaymentMethod,
      cashTendered: Number(cashTendered) || order.finalTotalAmount,
      changeReturned: Number(changeReturned) || 0,
      status: 'SUCCESS',
      processedBy: 'Counter 1'
    };

    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        const Payment = require('../models/Payment');
        const payment = new Payment(paymentData);
        await payment.save();
        syncPaymentToOracle(payment).catch(() => {});
      } catch (e) {}
    }

    order.paymentStatus = 'PAID';
    order.paymentMethod = finalPaymentMethod;
    order.orderStatus = 'SERVED';
    if (!order.timestamps) order.timestamps = {};
    order.timestamps.completedAt = new Date();

    if (order.save) {
      try { await order.save(); } catch (e) {}
    }
    localDataStore.saveOrder(order.toObject ? order.toObject() : order);
    syncOrderToOracle(order).catch(() => {});

    const { emitPaymentRecorded, emitStatusChange } = require('../sockets/socketHandler');
    emitPaymentRecorded(paymentData, order);
    emitStatusChange(order);

    res.json({
      success: true,
      message: `Table order ${order.orderNumber} settled successfully via ${finalPaymentMethod}! Table is now available.`,
      order,
      payment: paymentData
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get Table-Wise Performance Analytics (Daily & Monthly breakdown)
 * Query params: period=today | yesterday | month | all, date=YYYY-MM-DD
 */
async function getTablePerformance(req, res) {
  try {
    const { period = 'today', date } = req.query;
    const now = new Date();
    let startDate, endDate;

    if (date) {
      const [y, m, d] = date.split('-').map(Number);
      startDate = new Date(y, m - 1, d, 0, 0, 0, 0);
      endDate = new Date(y, m - 1, d, 23, 59, 59, 999);
    } else if (period === 'yesterday') {
      const yDate = new Date(now);
      yDate.setDate(yDate.getDate() - 1);
      startDate = new Date(yDate.getFullYear(), yDate.getMonth(), yDate.getDate(), 0, 0, 0, 0);
      endDate = new Date(yDate.getFullYear(), yDate.getMonth(), yDate.getDate(), 23, 59, 59, 999);
    } else if (period === 'month') {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else { // 'today' default
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    }

    let allOrders = [];
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      try {
        allOrders = await Order.find({
          createdAt: { $gte: startDate, $lte: endDate },
          orderStatus: { $ne: 'CANCELLED' }
        }).sort({ createdAt: -1 }).maxTimeMS(1500);
      } catch (e) {
        allOrders = [];
      }
    }

    const localOrders = localDataStore.getOrders().filter(o => {
      const cAt = new Date(o.createdAt);
      return cAt >= startDate && cAt <= endDate && o.orderStatus !== 'CANCELLED';
    });

    const orderMap = new Map();
    allOrders.forEach(o => orderMap.set(o.orderNumber, o));
    localOrders.forEach(o => {
      if (!orderMap.has(o.orderNumber)) orderMap.set(o.orderNumber, o);
    });

    const ordersInPeriod = Array.from(orderMap.values());
    const totalTables = await getConfiguredTableCount();

    const tablesReport = [];
    let grandRevenue = 0;
    let grandOrders = 0;

    for (let i = 1; i <= totalTables; i++) {
      const tLabel = `Table ${i}`;
      const tOrders = ordersInPeriod.filter(o => {
        const tbl = (o.locationDetails?.tableNumber || '').trim().toLowerCase();
        return tbl === tLabel.toLowerCase() || tbl === `t${i}` || tbl === `table 0${i}` || tbl === `${i}`;
      });

      const rev = tOrders.reduce((acc, o) => acc + (Number(o.finalTotalAmount) || 0), 0);
      const itemsCount = tOrders.reduce((acc, o) => acc + (Number(o.totalItemCount) || 0), 0);
      const paidOrders = tOrders.filter(o => o.paymentStatus === 'PAID').length;
      const unpaidOrders = tOrders.filter(o => o.paymentStatus !== 'PAID').length;

      grandRevenue += rev;
      grandOrders += tOrders.length;

      tablesReport.push({
        tableNumber: tLabel,
        tableId: i,
        orderCount: tOrders.length,
        totalRevenue: rev,
        itemsCount,
        averageBill: tOrders.length > 0 ? Math.round(rev / tOrders.length) : 0,
        paidOrders,
        unpaidOrders
      });
    }

    // Takeaways breakdown
    const takeawayOrders = ordersInPeriod.filter(o => {
      const tbl = (o.locationDetails?.tableNumber || '').trim().toLowerCase();
      return o.orderType === 'TAKEAWAY' || tbl.includes('takeaway') || tbl.includes('pickup');
    });
    const takeawayRev = takeawayOrders.reduce((acc, o) => acc + (Number(o.finalTotalAmount) || 0), 0);
    grandRevenue += takeawayRev;
    grandOrders += takeawayOrders.length;

    tablesReport.push({
      tableNumber: 'Takeaway',
      tableId: 0,
      orderCount: takeawayOrders.length,
      totalRevenue: takeawayRev,
      itemsCount: takeawayOrders.reduce((acc, o) => acc + (Number(o.totalItemCount) || 0), 0),
      averageBill: takeawayOrders.length > 0 ? Math.round(takeawayRev / takeawayOrders.length) : 0,
      paidOrders: takeawayOrders.filter(o => o.paymentStatus === 'PAID').length,
      unpaidOrders: takeawayOrders.filter(o => o.paymentStatus !== 'PAID').length
    });

    res.json({
      success: true,
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      grandTotalRevenue: grandRevenue,
      grandTotalOrders: grandOrders,
      tables: tablesReport
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Merge multiple active tables into a single primary table (e.g. Party of 40 on Tables 1, 3, 5, 8)
 */
async function mergeTableOrders(req, res) {
  try {
    const { primaryTable, secondaryTables = [] } = req.body;

    if (!primaryTable || !secondaryTables.length) {
      return res.status(400).json({ success: false, message: 'Primary table and at least one secondary table are required.' });
    }

    const tableRegex = new RegExp(`^${primaryTable.trim()}$`, 'i');
    let primaryOrder = await Order.findOne({
      'locationDetails.tableNumber': { $regex: tableRegex },
      paymentStatus: { $ne: 'PAID' },
      orderStatus: { $ne: 'CANCELLED' }
    });

    if (!primaryOrder) {
      return res.status(400).json({
        success: false,
        message: `${primaryTable} does not have an active bill to merge into. Please place an order on ${primaryTable} first.`
      });
    }

    for (const secTable of secondaryTables) {
      const secRegex = new RegExp(`^${secTable.trim()}$`, 'i');
      const secOrder = await Order.findOne({
        'locationDetails.tableNumber': { $regex: secRegex },
        paymentStatus: { $ne: 'PAID' },
        orderStatus: { $ne: 'CANCELLED' }
      });

      if (secOrder && secOrder.items && secOrder.items.length) {
        secOrder.items.forEach(it => {
          primaryOrder.items.push({
            menuItemId: it.menuItemId,
            sku: it.sku,
            title: `${it.title} (${secTable})`,
            category: it.category,
            variant: it.variant,
            unitPrice: it.unitPrice,
            quantity: it.quantity,
            subtotal: it.subtotal || (it.unitPrice * it.quantity),
            specialInstructions: it.specialInstructions || ''
          });
        });

        // Mark secondary order as merged/paid so secondary table is freed
        secOrder.paymentStatus = 'PAID';
        secOrder.orderStatus = 'SERVED';
        secOrder.kitchenNotes = (secOrder.kitchenNotes || '') + ` [Merged into ${primaryTable}]`;
        await secOrder.save();
        syncOrderToOracle(secOrder).catch(() => {});
      }
    }

    // Recalculate primaryOrder totals
    let newSubtotal = 0;
    let newItemCount = 0;
    primaryOrder.items.forEach(it => {
      newSubtotal += (it.subtotal || (it.unitPrice * it.quantity));
      newItemCount += (Number(it.quantity) || 1);
    });

    primaryOrder.subtotalAmount = newSubtotal;
    primaryOrder.totalItemCount = newItemCount;
    primaryOrder.finalTotalAmount = Math.max(0, newSubtotal - (Number(primaryOrder.discountAmount) || 0));
    primaryOrder.kitchenNotes = (primaryOrder.kitchenNotes || '') + ` [Group Bill: Merged ${secondaryTables.join(', ')}]`;

    await primaryOrder.save();
    syncOrderToOracle(primaryOrder).catch(() => {});

    const { getIO } = require('../sockets/socketHandler');
    const io = getIO();
    if (io) {
      io.emit('tables:count_updated', {});
    }

    res.json({
      success: true,
      message: `Merged ${secondaryTables.join(', ')} into ${primaryTable}! Total bill is now ₹${primaryOrder.finalTotalAmount}.`,
      order: primaryOrder
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
  decreaseTableCount,
  mergeTableOrders,
  getTablePerformance
};
