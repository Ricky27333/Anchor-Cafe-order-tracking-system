const express = require('express');
const router = express.Router();
const {
  recordExpense,
  getExpenses,
  getSalesVsExpensesSummary,
  updateExpense,
  deleteExpense
} = require('../controllers/expenseController');

router.post('/', recordExpense);
router.get('/', getExpenses);
router.get('/summary', getSalesVsExpensesSummary);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

module.exports = router;
