const express = require('express');
const router = express.Router();
const {
  createOrder,
  getLiveOrders,
  getAllOrders,
  trackOrderByNumber,
  updateOrderStatus,
  getTablesOverview,
  settleTablePayment,
  increaseTableCount,
  decreaseTableCount,
  mergeTableOrders
} = require('../controllers/orderController');

router.post('/', createOrder);
router.get('/', getAllOrders);
router.get('/tables', getTablesOverview);
router.post('/tables/increase', increaseTableCount);
router.post('/tables/decrease', decreaseTableCount);
router.post('/tables/merge', mergeTableOrders);
router.post('/settle-table', settleTablePayment);
router.get('/live', getLiveOrders);
router.get('/track/:orderNumber', trackOrderByNumber);
router.patch('/:id/status', updateOrderStatus);

module.exports = router;
