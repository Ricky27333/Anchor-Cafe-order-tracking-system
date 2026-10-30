const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const localDataStore = require('../src/services/localDataStore');

let mongoServer;

beforeAll(async () => {
  if (localDataStore && localDataStore.getOrders()) {
    localDataStore.getOrders().length = 0;
  }
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('Table Order Lifecycle & Status Progression (ORDERED -> READY -> SERVED -> PAID)', () => {
  let table2OrderId;
  let table2OrderNum;

  // =========================================================================
  // Condition 1: Note down customer order for Table 2 (Initial State: PENDING)
  // =========================================================================
  it('Condition 1: Customer sits at Table 2; notes down order; starts as PENDING', async () => {
    const orderPayload = {
      orderType: 'DINE_IN',
      locationDetails: { tableNumber: 'Table 2', customerName: 'Venkatesh' },
      items: [
        { title: 'Masala Chai', category: 'hot-beverages', unitPrice: 30, quantity: 2 },
        { title: 'Veg Club Sandwich', category: 'snacks', unitPrice: 99, quantity: 1 }
      ]
    };

    const res = await request(app).post('/api/orders').send(orderPayload);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.order.orderStatus).toBe('PENDING');
    expect(res.body.order.paymentStatus).toBe('UNPAID');
    expect(res.body.order.finalTotalAmount).toBe(159); // (30*2) + 99 = 159
    expect(res.body.order.totalItemCount).toBe(3);

    table2OrderId = res.body.order._id;
    table2OrderNum = res.body.order.orderNumber;

    // Verify Table 2 shows occupied in floor overview with exact items
    const tblRes = await request(app).get('/api/orders/tables');
    expect(tblRes.statusCode).toBe(200);
    const t2 = tblRes.body.tables.find(t => t.tableNumber === 'Table 2');
    expect(t2).toBeDefined();
    expect(t2.isOccupied).toBe(true);
    expect(t2.order.orderNumber).toBe(table2OrderNum);
    expect(t2.order.orderStatus).toBe('PENDING');
    expect(t2.order.finalTotalAmount).toBe(159);
    expect(t2.order.items).toHaveLength(2);
  });

  // =========================================================================
  // Condition 2: Kitchen prepares food; waiter confirms READY_FOR_PICKUP
  // =========================================================================
  it('Condition 2: Waiter confirms food is ready (PENDING -> READY_FOR_PICKUP)', async () => {
    const patchRes = await request(app)
      .patch(`/api/orders/${table2OrderId}/status`)
      .send({ status: 'READY_FOR_PICKUP' });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body.success).toBe(true);
    expect(patchRes.body.order.orderStatus).toBe('READY_FOR_PICKUP');
    expect(patchRes.body.order.timestamps?.readyAt || patchRes.body.order.readyAt).toBeDefined();

    // Verify Table overview reflects READY_FOR_PICKUP
    const tblRes = await request(app).get('/api/orders/tables');
    const t2 = tblRes.body.tables.find(t => t.tableNumber === 'Table 2');
    expect(t2.order.orderStatus).toBe('READY_FOR_PICKUP');
  });

  // =========================================================================
  // Condition 3: Food is delivered; waiter confirms SERVED to table
  // =========================================================================
  it('Condition 3: Waiter serves food to Table 2 (READY_FOR_PICKUP -> SERVED)', async () => {
    const patchRes = await request(app)
      .patch(`/api/orders/${table2OrderId}/status`)
      .send({ status: 'SERVED' });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body.success).toBe(true);
    expect(patchRes.body.order.orderStatus).toBe('SERVED');

    // Verify Table overview reflects SERVED
    const tblRes = await request(app).get('/api/orders/tables');
    const t2 = tblRes.body.tables.find(t => t.tableNumber === 'Table 2');
    expect(t2.order.orderStatus).toBe('SERVED');
  });

  // =========================================================================
  // Condition 4: Customer asks for reorder / extra water bottle while dining
  // =========================================================================
  it('Condition 4: Customer reorders 2x Water Bottles; appends to Table 2 bill seamlessly', async () => {
    const reorderPayload = {
      orderType: 'DINE_IN',
      locationDetails: { tableNumber: 'Table 2', customerName: 'Venkatesh' },
      items: [
        { title: 'Packaged Drinking Water (1 Litre)', category: 'soft-drinks', unitPrice: 20, quantity: 2 }
      ]
    };

    const res = await request(app).post('/api/orders').send(reorderPayload);
    expect(res.statusCode).toBe(200); // 200 appended to existing active order
    expect(res.body.success).toBe(true);
    // Previous 159 + (20*2) = 199
    expect(res.body.order.finalTotalAmount).toBe(199);
    expect(res.body.order.totalItemCount).toBe(5);

    // Verify Table 2 retains all previous items plus water bottles
    const tblRes = await request(app).get('/api/orders/tables');
    const t2 = tblRes.body.tables.find(t => t.tableNumber === 'Table 2');
    expect(t2.order.finalTotalAmount).toBe(199);
    expect(t2.order.items.some(i => i.title.includes('Water'))).toBe(true);
    expect(t2.order.items.some(i => i.title.includes('Chai'))).toBe(true);
  });

  // =========================================================================
  // Condition 5: Payment completed; Table 2 settled and freed for new guests
  // =========================================================================
  it('Condition 5: Cash payment collected; Table 2 settles to PAID and becomes vacant', async () => {
    const settleRes = await request(app)
      .post('/api/orders/settle-table')
      .send({
        orderId: table2OrderId,
        paymentMethod: 'CASH',
        amountReceived: 199
      });

    expect(settleRes.statusCode).toBe(200);
    expect(settleRes.body.success).toBe(true);
    expect(settleRes.body.order.paymentStatus).toBe('PAID');

    // Table 2 MUST now be vacant and available for next customer
    const tblRes = await request(app).get('/api/orders/tables');
    const t2 = tblRes.body.tables.find(t => t.tableNumber === 'Table 2');
    expect(t2.isOccupied).toBe(false);
    expect(t2.order).toBeNull();
  });

  // =========================================================================
  // Condition 6: Order status update by human-readable orderNumber
  // =========================================================================
  it('Condition 6: Can update status using human-readable orderNumber identifier', async () => {
    // Create new order for Table 5
    const res = await request(app).post('/api/orders').send({
      orderType: 'DINE_IN',
      locationDetails: { tableNumber: 'Table 5', customerName: 'Anil' },
      items: [{ title: 'Cold Coffee', category: 'cold-coffee', unitPrice: 89, quantity: 1 }]
    });
    const orderNum = res.body.order.orderNumber;

    const patchRes = await request(app)
      .patch(`/api/orders/${orderNum}/status`)
      .send({ status: 'READY_FOR_PICKUP' });

    expect(patchRes.statusCode).toBe(200);
    expect(patchRes.body.order.orderStatus).toBe('READY_FOR_PICKUP');
  });

  // =========================================================================
  // Condition 7: Error handling for invalid inputs and non-existent orders
  // =========================================================================
  it('Condition 7: Proper error codes for invalid order ID or missing status', async () => {
    // Non-existent ID
    const notFoundRes = await request(app)
      .patch('/api/orders/64f000000000000000000000/status')
      .send({ status: 'SERVED' });
    expect(notFoundRes.statusCode).toBe(404);
    expect(notFoundRes.body.success).toBe(false);

    // Missing status field
    const badReqRes = await request(app)
      .patch(`/api/orders/${table2OrderId}/status`)
      .send({});
    expect(badReqRes.statusCode).toBe(400);
    expect(badReqRes.body.success).toBe(false);
  });

  // =========================================================================
  // Condition 8: Multi-table concurrency (Tables 1, 3, 7 at different statuses)
  // =========================================================================
  it('Condition 8: Handles multiple tables concurrently at different lifecycle statuses', async () => {
    // 1. Table 1 -> PENDING
    const r1 = await request(app).post('/api/orders').send({
      orderType: 'DINE_IN',
      locationDetails: { tableNumber: 'Table 1', customerName: 'Party A' },
      items: [{ title: 'Filter Coffee', unitPrice: 40, quantity: 2 }]
    });

    // 2. Table 3 -> READY_FOR_PICKUP
    const r3 = await request(app).post('/api/orders').send({
      orderType: 'DINE_IN',
      locationDetails: { tableNumber: 'Table 3', customerName: 'Party B' },
      items: [{ title: 'Chicken Nuggets', unitPrice: 129, quantity: 1 }]
    });
    await request(app).patch(`/api/orders/${r3.body.order._id}/status`).send({ status: 'READY_FOR_PICKUP' });

    // 3. Table 7 -> SERVED
    const r7 = await request(app).post('/api/orders').send({
      orderType: 'DINE_IN',
      locationDetails: { tableNumber: 'Table 7', customerName: 'Party C' },
      items: [{ title: 'Mojito Mint', unitPrice: 99, quantity: 2 }]
    });
    await request(app).patch(`/api/orders/${r7.body.order._id}/status`).send({ status: 'SERVED' });

    // Verify all 3 tables are in their correct respective states simultaneously
    const overview1 = await request(app).get('/api/orders/tables');
    const t1 = overview1.body.tables.find(t => t.tableNumber === 'Table 1');
    const t3 = overview1.body.tables.find(t => t.tableNumber === 'Table 3');
    const t7 = overview1.body.tables.find(t => t.tableNumber === 'Table 7');

    expect(t1.isOccupied).toBe(true);
    expect(t1.order.orderStatus).toBe('PENDING');

    expect(t3.isOccupied).toBe(true);
    expect(t3.order.orderStatus).toBe('READY_FOR_PICKUP');

    expect(t7.isOccupied).toBe(true);
    expect(t7.order.orderStatus).toBe('SERVED');

    // Settle Table 3 only
    await request(app).post('/api/orders/settle-table').send({
      orderId: r3.body.order._id,
      paymentMethod: 'UPI'
    });

    // Verify Table 3 is vacant, while Table 1 and Table 7 remain occupied
    const overview2 = await request(app).get('/api/orders/tables');
    const t1After = overview2.body.tables.find(t => t.tableNumber === 'Table 1');
    const t3After = overview2.body.tables.find(t => t.tableNumber === 'Table 3');
    const t7After = overview2.body.tables.find(t => t.tableNumber === 'Table 7');

    expect(t3After.isOccupied).toBe(false);
    expect(t1After.isOccupied).toBe(true);
    expect(t7After.isOccupied).toBe(true);
  });
});
