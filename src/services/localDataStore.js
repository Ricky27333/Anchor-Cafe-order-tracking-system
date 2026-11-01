const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const isTestEnv = process.env.NODE_ENV === 'test' || process.env.JEST_WORKER_ID !== undefined;
const STORE_FILE = isTestEnv
  ? path.join(DATA_DIR, 'anchortrack_test_store.json')
  : path.join(DATA_DIR, 'anchortrack_store.json');
const BACKUP_FILE = path.join(DATA_DIR, 'anchortrack_store.backup.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (e) {
    console.error('Error creating data directory:', e);
  }
}

// In-memory cache synced with disk
let store = {
  orders: [],
  expenses: [],
  settings: {
    tableCount: 9
  }
};

function loadStore() {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      store = JSON.parse(raw);
      if (!Array.isArray(store.orders)) store.orders = [];
      if (!Array.isArray(store.expenses)) store.expenses = [];
      if (!store.settings) store.settings = { tableCount: 9 };
    } else {
      saveStore();
    }
  } catch (err) {
    console.warn('⚠️ [DataStore] Could not read store file, using in-memory store:', err.message);
  }
}

function saveStore() {
  try {
    const dataStr = JSON.stringify(store, null, 2);
    fs.writeFileSync(STORE_FILE, dataStr, 'utf-8');
    if (!isTestEnv) {
      try {
        fs.writeFileSync(BACKUP_FILE, dataStr, 'utf-8');
      } catch (be) {}
    }
  } catch (err) {
    console.error('⚠️ [DataStore] Error persisting to disk:', err.message);
  }
}

// Initialize on startup
loadStore();

module.exports = {
  getOrders: () => store.orders,
  getOrderById: (id) => store.orders.find(o => String(o._id) === String(id) || o.orderNumber === id),
  saveOrder: (orderData) => {
    const existingIdx = store.orders.findIndex(o => 
      (orderData._id && String(o._id) === String(orderData._id)) || 
      (orderData.orderNumber && o.orderNumber === orderData.orderNumber)
    );

    if (existingIdx > -1) {
      store.orders[existingIdx] = {
        ...store.orders[existingIdx],
        ...orderData,
        updatedAt: new Date().toISOString()
      };
      saveStore();
      return store.orders[existingIdx];
    } else {
      const newOrder = {
        _id: orderData._id || `ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        ...orderData,
        createdAt: orderData.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      store.orders.unshift(newOrder);
      saveStore();
      return newOrder;
    }
  },
  getActiveOrdersForTable: (tableNumber) => {
    const norm = String(tableNumber || '').trim().toLowerCase();
    return store.orders.filter(o => {
      const t = String(o.locationDetails?.tableNumber || '').trim().toLowerCase();
      const isMatch = t === norm || t === norm.replace('table ', 't') || t.replace('table ', 't') === norm;
      const isUnpaid = o.paymentStatus !== 'PAID';
      const notCancelled = o.orderStatus !== 'CANCELLED';
      return isMatch && isUnpaid && notCancelled;
    });
  },
  getTableCount: () => store.settings.tableCount || 9,
  setTableCount: (count) => {
    store.settings.tableCount = Math.max(1, Math.min(50, count));
    saveStore();
    return store.settings.tableCount;
  },
  getExpenses: () => store.expenses,
  saveExpense: (expenseData) => {
    const newExp = {
      _id: expenseData._id || `EXP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ...expenseData,
      createdAt: expenseData.createdAt || new Date().toISOString()
    };
    store.expenses.unshift(newExp);
    saveStore();
    return newExp;
  },
  updateExpense: (id, updateData) => {
    const idx = store.expenses.findIndex(e => String(e._id) === String(id));
    if (idx > -1) {
      store.expenses[idx] = {
        ...store.expenses[idx],
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      saveStore();
      return store.expenses[idx];
    }
    return null;
  },
  deleteExpense: (id) => {
    const idx = store.expenses.findIndex(e => String(e._id) === String(id));
    if (idx > -1) {
      const removed = store.expenses.splice(idx, 1)[0];
      saveStore();
      return removed;
    }
    return null;
  }
};
