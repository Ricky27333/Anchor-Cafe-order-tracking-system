const express = require('express');
const router = express.Router();
const {
  getMonthlyReport,
  getDailySummary,
  closeDayReport,
  resetRecords
} = require('../controllers/reportController');

router.get('/monthly', getMonthlyReport);
router.get('/daily/summary', getDailySummary);
router.post('/daily/close-day', closeDayReport);
router.post('/reset-records', resetRecords);

module.exports = router;
