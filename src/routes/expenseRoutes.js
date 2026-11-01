const express = require('express');
const router = express.Router();
const {
  recordExpense,
  getExpenses,
  getRawMaterialIntelligence,
  getSalesVsExpensesSummary,
  updateExpense,
  deleteExpense,
  exportExpensesCsv
} = require('../controllers/expenseController');

router.post('/', recordExpense);
router.get('/', getExpenses);
router.get('/intelligence', getRawMaterialIntelligence);
router.get('/export/csv', exportExpensesCsv);
router.get('/summary', getSalesVsExpensesSummary);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
