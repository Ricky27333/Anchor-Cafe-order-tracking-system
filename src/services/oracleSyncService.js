/**
 * Oracle Database Sync Service
 * Seamlessly mirrors POS orders, line items, 1-tap payments, and daily expenses
 * to the ANCHOR_TRACK isolated schema in Oracle Database.
 */

const { executeQuery, initOraclePool } = require('../config/oracleDatabase');

let isOracleReady = false;

// Attempt pool initialization quietly on startup
(async () => {
  try {
    const pool = await initOraclePool();
    if (pool) {
      isOracleReady = true;
      console.log('🔗 [Oracle Sync Service] Active & ready to mirror transactions.');
    }
  } catch (e) {
    isOracleReady = false;
  }
})();

/**
 * Sync an order and its itemized lines to Oracle DB
 * Target Tables: ANCHOR_TRACK.ORDERS and ANCHOR_TRACK.ORDER_ITEMS
 */
async function syncOrderToOracle(order) {
  if (!isOracleReady) return;

  try {
    const orderNumber = order.orderNumber;
    const orderType = order.orderType || 'DINE_IN';
    const tableNumber = (order.locationDetails && order.locationDetails.tableNumber) ? order.locationDetails.tableNumber : 'Takeaway';
    const customerName = (order.locationDetails && order.locationDetails.customerName) ? order.locationDetails.customerName : 'Guest';
    const totalItems = order.totalItemCount || order.items.length || 0;
    const subtotal = order.subtotalAmount || order.finalTotalAmount || 0;
    const finalTotal = order.finalTotalAmount || subtotal;
    const orderStatus = order.orderStatus || 'PENDING';
    const paymentStatus = order.paymentStatus || 'UNPAID';
    const paymentMethod = order.paymentMethod || 'PHONEPE';

    // 1. Insert or update ORDERS table using MERGE
    const mergeOrderSql = `
      MERGE INTO ANCHOR_TRACK.ORDERS target
      USING (SELECT :orderNumber AS order_num FROM dual) src
      ON (target.ORDER_NUMBER = src.order_num)
      WHEN MATCHED THEN
        UPDATE SET 
          TOTAL_ITEMS = :totalItems,
          SUBTOTAL_AMOUNT = :subtotal,
          FINAL_TOTAL_AMOUNT = :finalTotal,
          ORDER_STATUS = :orderStatus,
          PAYMENT_STATUS = :paymentStatus,
          PAYMENT_METHOD = :paymentMethod,
          COMPLETED_AT = CASE WHEN :paymentStatus = 'PAID' THEN CURRENT_TIMESTAMP ELSE target.COMPLETED_AT END
      WHEN NOT MATCHED THEN
        INSERT (ORDER_NUMBER, ORDER_TYPE, TABLE_NUMBER, CUSTOMER_NAME, TOTAL_ITEMS, SUBTOTAL_AMOUNT, FINAL_TOTAL_AMOUNT, ORDER_STATUS, PAYMENT_STATUS, PAYMENT_METHOD, CREATED_AT)
        VALUES (:orderNumber, :orderType, :tableNumber, :customerName, :totalItems, :subtotal, :finalTotal, :orderStatus, :paymentStatus, :paymentMethod, CURRENT_TIMESTAMP)
    `;

    await executeQuery(mergeOrderSql, {
      orderNumber,
      orderType,
      tableNumber,
      customerName,
      totalItems,
      subtotal,
      finalTotal,
      orderStatus,
      paymentStatus,
      paymentMethod
    });

    // 2. Fetch the generated or existing ORDER_ID
    const getOrderIdSql = `SELECT ID FROM ANCHOR_TRACK.ORDERS WHERE ORDER_NUMBER = :orderNumber`;
    const orderRes = await executeQuery(getOrderIdSql, { orderNumber });
    if (orderRes && orderRes.rows && orderRes.rows.length > 0) {
      const oracleOrderId = orderRes.rows[0].ID;

      // Clear previous lines for this order (in case of added items)
      await executeQuery(`DELETE FROM ANCHOR_TRACK.ORDER_ITEMS WHERE ORDER_ID = :oracleOrderId`, { oracleOrderId });

      // Insert current order items
      if (order.items && order.items.length > 0) {
        for (const item of order.items) {
          const itemTitle = item.title;
          const variant = item.variant || null;
          const unitPrice = item.unitPrice || 0;
          const qty = item.quantity || 1;
          const lineTotal = item.subtotal || (unitPrice * qty);

          await executeQuery(`
            INSERT INTO ANCHOR_TRACK.ORDER_ITEMS (ORDER_ID, TITLE, VARIANT, UNIT_PRICE, QUANTITY, LINE_TOTAL)
            VALUES (:oracleOrderId, :itemTitle, :variant, :unitPrice, :qty, :lineTotal)
          `, {
            oracleOrderId,
            itemTitle,
            variant,
            unitPrice,
            qty,
            lineTotal
          });
        }
      }
    }

    console.log(`📡 [Oracle Sync] Synced order ${orderNumber} (${tableNumber}) to ANCHOR_TRACK.ORDERS`);
  } catch (err) {
    console.warn(`⚠️ [Oracle Sync Warning] Order sync skipped: ${err.message}`);
  }
}

/**
 * Sync a 1-tap payment transaction to Oracle DB
 * Target Table: ANCHOR_TRACK.PAYMENTS
 */
async function syncPaymentToOracle(payment) {
  if (!isOracleReady) return;

  try {
    const txnId = payment.paymentTransactionId || `TXN-${Date.now()}`;
    const orderNumber = payment.orderNumber || '';
    const amount = payment.amount || 0;
    const method = payment.paymentMethod || 'PHONEPE';
    const status = payment.paymentStatus || 'SUCCESS';
    const processedBy = payment.processedBy || 'Counter 1';

    const insertPaymentSql = `
      INSERT INTO ANCHOR_TRACK.PAYMENTS (TRANSACTION_ID, ORDER_NUMBER, AMOUNT_RECEIVED, PAYMENT_METHOD, STATUS, PROCESSED_BY, CREATED_AT)
      VALUES (:txnId, :orderNumber, :amount, :method, :status, :processedBy, CURRENT_TIMESTAMP)
    `;

    await executeQuery(insertPaymentSql, {
      txnId,
      orderNumber,
      amount,
      method,
      status,
      processedBy
    });

    console.log(`📡 [Oracle Sync] Recorded payment ${txnId} (₹${amount}) to ANCHOR_TRACK.PAYMENTS`);
  } catch (err) {
    console.warn(`⚠️ [Oracle Sync Warning] Payment sync skipped: ${err.message}`);
  }
}

/**
 * Sync daily operational expense to Oracle DB
 * Target Table: ANCHOR_TRACK.EXPENSES
 */
async function syncExpenseToOracle(expense) {
  if (!isOracleReady) return;

  try {
    const title = expense.title;
    const category = expense.category || 'MILK_DAIRY';
    const amount = expense.amount;
    const deductedFrom = expense.deductedFrom || 'TODAYS_SALES';
    const notes = expense.notes || '';
    const recordedBy = expense.recordedBy || 'Counter 1';

    const insertExpenseSql = `
      INSERT INTO ANCHOR_TRACK.EXPENSES (TITLE, CATEGORY, AMOUNT, DEDUCTED_FROM, RECORDED_BY, NOTES, CREATED_AT)
      VALUES (:title, :category, :amount, :deductedFrom, :recordedBy, :notes, CURRENT_TIMESTAMP)
    `;

    await executeQuery(insertExpenseSql, {
      title,
      category,
      amount,
      deductedFrom,
      recordedBy,
      notes
    });

    console.log(`📡 [Oracle Sync] Recorded requirement expense "${title}" (₹${amount}) to ANCHOR_TRACK.EXPENSES`);
  } catch (err) {
    console.warn(`⚠️ [Oracle Sync Warning] Expense sync skipped: ${err.message}`);
  }
}

/**
 * Sync updated selling price and base cost to Oracle MENU_ITEMS table
 */
async function syncMenuItemPriceToOracle(item) {
  if (!isOracleReady) return;
  try {
    await executeQuery(`
      UPDATE ANCHOR_TRACK.MENU_ITEMS
      SET SELLING_PRICE = :sellingPrice, BASE_COST = :baseCost
      WHERE SKU = :sku
    `, {
      sellingPrice: item.sellingPrice,
      baseCost: item.baseCost,
      sku: item.sku
    });
    console.log(`📡 [Oracle Sync] Updated price for ${item.sku} to ₹${item.sellingPrice} in ANCHOR_TRACK.MENU_ITEMS`);
  } catch (err) {
    console.warn(`⚠️ [Oracle Sync Warning] Menu item price update skipped: ${err.message}`);
  }
}

module.exports = {
  syncOrderToOracle,
  syncPaymentToOracle,
  syncExpenseToOracle,
  syncMenuItemPriceToOracle
};
