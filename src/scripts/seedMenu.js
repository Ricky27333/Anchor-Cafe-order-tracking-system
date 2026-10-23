require('dotenv').config();
const { connectDB, closeDB } = require('../config/database');
const MenuItem = require('../models/MenuItem');
const { fullCatalog } = require('./menuCatalogData');

async function seedDatabase() {
  console.log('⚓ Starting AnchorTrack Menu Catalog Seeding...');
  try {
    await connectDB();

    console.log('🧹 Clearing previous menu catalog...');
    await MenuItem.deleteMany({});

    console.log(`🌱 Seeding ${fullCatalog.length} master items (including 27 shakes with 3-variant matrix)...`);
    
    // We insert each item to trigger any pre-save hooks or insertMany
    const inserted = await MenuItem.insertMany(fullCatalog);
    console.log(`✅ Successfully seeded ${inserted.length} menu items into Anchor Cafe database!`);

    // Category summary
    const categories = await MenuItem.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);

    console.log('📊 Category Breakdown:');
    categories.forEach(c => {
      console.log(`   - ${c._id}: ${c.count} items`);
    });

    console.log('🌊 Seeding complete!');
    return inserted;
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    throw error;
  }
}

if (require.main === module) {
  seedDatabase()
    .then(async () => {
      await closeDB();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(err);
      await closeDB();
      process.exit(1);
    });
}

module.exports = seedDatabase;
