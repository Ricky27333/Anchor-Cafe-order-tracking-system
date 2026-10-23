const request = require('supertest');
const app = require('../src/app');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('POST /api/orders & Complete Lifecycle', () => {
  let createdOrderId;
  let orderNumber;

  it('should create an order with exact charm prices and calculate totals accurately', async () => {
    const payload = {
      orderType: 'DINE_IN',
      locationDetails: { tableNumber: 'Deck Table 3', customerName: 'Rajesh' },
      items: [
        { title: 'Filter Coffee', category: 'hot-beverages', unitPrice: 40, quantity: 2 },
        { title: 'Mint Lime Mojito', category: 'mojitos', unitPrice: 99, quantity: 1 },
        { title: 'French Fries', category: 'snacks', unitPrice: 99, quantity: 1 }
      ]
    };

    const res = await request(app).post('/api/orders').send(payload);
    expect(res.statusCode).toBe(201);
    expect(res.body.success).toBe(true);
    // (40*2) + 99 + 99 = 80 + 198 = 278
    expect(res.body.order.finalTotalAmount).toBe(278);
    expect(res.body.order.totalItemCount).toBe(4);
    expect(res.body.order.orderStatus).toBe('PENDING');

    createdOrderId = res.body.order._id;
    orderNumber = res.body.order.orderNumber;
  });

  it('should fetch live orders and find the newly created pending order', async () => {
    const res = await request(app).get('/api/orders/live');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    const found = res.body.orders.find(o => o.orderNumber === orderNumber);
    expect(found).toBeDefined();
  });

  it('should allow kitchen to transition order to KITCHEN_PREPARING and READY_FOR_PICKUP', async () => {
    // 1. Preparing
    const prepRes = await request(app)
      .patch(`/api/orders/${createdOrderId}/status`)
      .send({ status: 'KITCHEN_PREPARING' });
    expect(prepRes.statusCode).toBe(200);
    expect(prepRes.body.order.orderStatus).toBe('KITCHEN_PREPARING');

    // 2. Ready for pickup
    const readyRes = await request(app)
      .patch(`/api/orders/${createdOrderId}/status`)
      .send({ status: 'READY_FOR_PICKUP' });
    expect(readyRes.statusCode).toBe(200);
    expect(readyRes.body.order.orderStatus).toBe('READY_FOR_PICKUP');
  });

  it('should track order publicly by order number with step calculation', async () => {
    const res = await request(app).get(`/api/orders/track/${orderNumber}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orderNumber).toBe(orderNumber);
    expect(res.body.step).toBe(3); // Ready for pickup
    expect(res.body.cafeSupportPhone).toBe('7702897213');
  });

  it('should generate dynamic UPI QR code with exact charm total', async () => {
    const res = await request(app)
      .post('/api/payments/generate-upi-qr')
      .send({ orderId: createdOrderId });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.amount).toBe(278);
    expect(res.body.qrDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(res.body.upiString).toContain('anchorcafe@icici');
    expect(res.body.upiString).toContain('278.00');
  });

  it('should record payment and update order paymentStatus to PAID', async () => {
    const payRes = await request(app)
      .post('/api/payments')
      .send({
        orderId: createdOrderId,
        orderNumber,
        amountReceived: 278,
        paymentMethod: 'UPI_PHONEPE',
        upiReferenceNumber: 'UPI202610229988'
      });

    expect(payRes.statusCode).toBe(201);
    expect(payRes.body.success).toBe(true);
    expect(payRes.body.payment.paymentMethod).toBe('UPI_PHONEPE');
    expect(payRes.body.order.paymentStatus).toBe('PAID');
  });

  it('should return 9 tables overview with live occupancy status', async () => {
    // Create an active order for Table 4
    await request(app).post('/api/orders').send({
      orderType: 'DINE_IN',
      locationDetails: { tableNumber: 'Table 4', customerName: 'Harsha' },
      items: [
        { title: 'Packaged Drinking Water (1 Litre)', category: 'soft-drinks', unitPrice: 20, quantity: 2 },
        { title: 'Thums Up (Charged / Cold Can)', category: 'soft-drinks', unitPrice: 40, quantity: 1 }
      ]
    });

    const res = await request(app).get('/api/orders/tables');
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.totalTables).toBe(9);
    expect(res.body.tables).toHaveLength(9);

    const t4 = res.body.tables.find(t => t.tableNumber === 'Table 4');
    expect(t4).toBeDefined();
    expect(t4.isOccupied).toBe(true);
    expect(t4.order.finalTotalAmount).toBe(80); // (20*2) + 40 = 80
  });

  it('should settle table order via PhonePe and free the table immediately', async () => {
    // Get Table 4's active order
    const tableRes = await request(app).get('/api/orders/tables');
    const t4 = tableRes.body.tables.find(t => t.tableNumber === 'Table 4');

    const settleRes = await request(app).post('/api/orders/settle-table').send({
      orderId: t4.order._id,
      paymentMethod: 'PHONEPE'
    });

    expect(settleRes.statusCode).toBe(200);
    expect(settleRes.body.success).toBe(true);
    expect(settleRes.body.order.paymentStatus).toBe('PAID');

    // Verify Table 4 is now vacant
    const recheckRes = await request(app).get('/api/orders/tables');
    const t4Recheck = recheckRes.body.tables.find(t => t.tableNumber === 'Table 4');
    expect(t4Recheck.isOccupied).toBe(false);
  });

  it('should return daily summary and monthly analytics', async () => {
    const dailyRes = await request(app).get('/api/reports/daily/summary');
    expect(dailyRes.statusCode).toBe(200);
    expect(dailyRes.body.totals.totalRevenue).toBeGreaterThanOrEqual(278);

    const monthlyRes = await request(app).get('/api/reports/monthly');
    expect(monthlyRes.statusCode).toBe(200);
    expect(monthlyRes.body.success).toBe(true);
  });
});
