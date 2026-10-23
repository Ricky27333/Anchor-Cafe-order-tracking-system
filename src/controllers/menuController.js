const MenuItem = require('../models/MenuItem');
const { fullCatalog } = require('../scripts/menuCatalogData');

/**
 * Get all menu items, optionally grouped or filtered
 */
async function getAllMenuItems(req, res) {
  try {
    const { category, availableOnly } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (availableOnly === 'true') filter.isAvailable = true;

    let items = await MenuItem.find(filter).sort({ category: 1, sku: 1 });

    // Auto-seed if database is empty or new items added to fullCatalog
    if ((items.length === 0 || items.length < fullCatalog.length) && !category) {
      console.log('🌱 Syncing master catalog with latest soft drinks & energy drinks...');
      for (const catItem of fullCatalog) {
        await MenuItem.findOneAndUpdate(
          { sku: catItem.sku },
          { $set: catItem },
          { upsert: true, new: true }
        );
      }
      items = await MenuItem.find(filter).sort({ category: 1, sku: 1 });
    }

    // Grouping by category
    const grouped = items.reduce((acc, item) => {
      const cat = item.category;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});

    res.json({
      success: true,
      count: items.length,
      categories: Object.keys(grouped),
      grouped,
      items
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Get menu items by category
 */
async function getMenuItemsByCategory(req, res) {
  try {
    const { category } = req.params;
    const items = await MenuItem.find({ category, isAvailable: true }).sort({ sku: 1 });
    res.json({
      success: true,
      category,
      count: items.length,
      items
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Toggle 86 / Out of Stock availability
 */
async function toggleAvailability(req, res) {
  try {
    const { id } = req.params;
    const item = await MenuItem.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    item.isAvailable = !item.isAvailable;
    await item.save();

    res.json({
      success: true,
      message: `Item "${item.title}" availability set to ${item.isAvailable}`,
      item
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Explicit reseed endpoint
 */
async function reseedMenu(req, res) {
  try {
    await MenuItem.deleteMany({});
    const inserted = await MenuItem.insertMany(fullCatalog);
    res.json({
      success: true,
      message: `Successfully re-seeded ${inserted.length} menu items with charm pricing!`,
      count: inserted.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

/**
 * Update price/cost for any menu item (soft drinks, water bottles, snacks, shakes)
 */
async function updateItemPrice(req, res) {
  try {
    const { id } = req.params;
    const { sellingPrice, baseCost, variants } = req.body;

    const item = await MenuItem.findById(id);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Menu item not found' });
    }

    if (sellingPrice !== undefined && sellingPrice !== null) {
      item.sellingPrice = Number(sellingPrice);
      item.baseCost = baseCost !== undefined ? Number(baseCost) : Number(sellingPrice);
      item.isMrp = true; // Mark as custom price
    }

    if (variants && Array.isArray(variants) && item.hasVariants) {
      item.isMrp = true;
      variants.forEach(v => {
        const found = item.variants.find(iv => iv.variantName === v.variantName);
        if (found) {
          if (v.sellingPrice !== undefined) found.sellingPrice = Number(v.sellingPrice);
          if (v.baseCost !== undefined) found.baseCost = Number(v.baseCost);
        }
      });
    }

    const updated = await item.save();

    // Mirror to Oracle DB ANCHOR_TRACK.MENU_ITEMS table
    try {
      const { syncMenuItemPriceToOracle } = require('../services/oracleSyncService');
      syncMenuItemPriceToOracle(updated).catch(() => {});
    } catch (e) {}

    // Broadcast price update to all screens via WebSocket
    const { getIO } = require('../sockets/socketHandler');
    const io = getIO();
    if (io) {
      io.emit('menu:price_updated', { item: updated });
    }

    res.json({
      success: true,
      message: `Price for "${updated.title}" successfully updated to ₹${updated.sellingPrice}!`,
      item: updated
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

module.exports = {
  getAllMenuItems,
  getMenuItemsByCategory,
  toggleAvailability,
  reseedMenu,
  updateItemPrice
};
