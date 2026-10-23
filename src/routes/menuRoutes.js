const express = require('express');
const router = express.Router();
const {
  getAllMenuItems,
  getMenuItemsByCategory,
  toggleAvailability,
  reseedMenu,
  updateItemPrice
} = require('../controllers/menuController');

router.get('/', getAllMenuItems);
router.get('/category/:category', getMenuItemsByCategory);
router.patch('/:id/availability', toggleAvailability);
router.patch('/:id/price', updateItemPrice);
router.put('/:id', updateItemPrice);
router.post('/seed', reseedMenu);

module.exports = router;
