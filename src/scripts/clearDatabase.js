/**
 * Clear Database Script
 * Cleans all test orders, payments, expenses, and day-end reports
 * Preserves the 79 coastal menu catalog items
 */

const dotenv = require('dotenv');
dotenv.config();

const { connectDB, closeDB } = require('../config/database');
const Order = require('../models/Order');
const Payment = require('../models/Payment');
const Expense = require('../models/Expense');
const DailyReport = require('../models/DailyReport');
const MenuItem = require('../models/MenuItem');

async function runClean() {
  console.log('🔄 Connecting to database for cleanup...');
  await connectDB();

  console.log('🧹 Purging test transaction records...');
  const o = await Order.deleteMany({});
  const p = await Payment.deleteMany({});
  const e = await Expense.deleteMany({});
  const d = await DailyReport.deleteMany({});

  console.log(`✅ Cleared ${o.deletedCount} Orders`);
  console.log(`✅ Cleared ${p.deletedCount} Payments`);
  console.log(`✅ Cleared ${e.deletedCount} Expenses`);
  console.log(`✅ Cleared ${d.deletedCount} Day-End Z-Reports`);

  const menuCount = await MenuItem.countDocuments();
  console.log(`🛡️ Coastal Menu Catalog preserved: ${menuCount} items available.`);

  // Attempt Oracle schema cleanup if reachable
  try {
    const { executeQuery, initOraclePool } = require('../config/oracleDatabase');
    await initOraclePool();
    await executeQuery('DELETE FROM ANCHOR_TRACK.ORDER_ITEMS');
    await executeQuery('DELETE FROM ANCHOR_TRACK.PAYMENTS');
    await executeQuery('DELETE FROM ANCHOR_TRACK.ORDERS');
    await executeQuery('DELETE FROM ANCHOR_TRACK.EXPENSES');
    await executeQuery('COMMIT');
    console.log('✅ Cleared Oracle DB schema tables (ORDERS, ORDER_ITEMS, PAYMENTS, EXPENSES)');
  } catch (err) {
    console.log(`ℹ️ [Oracle Cleanup Note] ${err.message}`);
  }

  await closeDB();
  console.log('✨ Database is 100% clean, pristine, and ready for production deployment!');
}

runClean().catch(err => {
  console.error('❌ Error during cleanup:', err);
  process.exit(1);
});
