const express = require('express');
const router = express.Router();
const {
  getMonthlyReport,
  getDailySummary,
  closeDayReport,
  exportDailyLedgerCsv,
  exportMonthlyCsv,
  exportMonthlyXlsx,
  resetRecords
} = require('../controllers/reportController');

router.get('/monthly', getMonthlyReport);
router.get('/export/daily-ledger-csv', exportDailyLedgerCsv);
router.get('/export/monthly-csv', exportMonthlyCsv);
router.get('/export/monthly-xlsx', exportMonthlyXlsx);
router.get('/daily/summary', getDailySummary);
router.post('/daily/close-day', closeDayReport);
router.post('/reset-records', resetRecords);

module.exports = router;
