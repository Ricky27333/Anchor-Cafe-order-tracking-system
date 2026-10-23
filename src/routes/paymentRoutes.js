const express = require('express');
const router = express.Router();
const {
  recordPayment,
  generateOrderUpiQr,
  getDailyPayments
} = require('../controllers/paymentController');

router.post('/', recordPayment);
router.post('/generate-upi-qr', generateOrderUpiQr);
router.get('/daily/:date', getDailyPayments);

module.exports = router;
