require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const { connectDB } = require('./config/database');
const { initSocket } = require('./sockets/socketHandler');

const PORT = process.env.PORT || 5000;

async function startServer() {
  // Connect to database
  await connectDB();

  // Auto-seed menu if empty
  try {
    const MenuItem = require('./models/MenuItem');
    const count = await MenuItem.countDocuments();
    if (count === 0) {
      console.log('🌱 Menu collection empty. Auto-seeding catalog with soft drinks, energy drinks, water bottles, and cafe menu...');
      const { fullCatalog } = require('./scripts/menuCatalogData');
      await MenuItem.insertMany(fullCatalog);
      console.log(`✅ Auto-seeded ${fullCatalog.length} coastal offerings!`);
    }
  } catch (seedErr) {
    console.warn(`ℹ️ [AnchorTrack] Initial catalog seeding skipped (Database pending): ${seedErr.message}`);
  }

  // Create HTTP server
  const server = http.createServer(app);

  // Initialize Socket.io
  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST', 'PATCH', 'DELETE']
    }
  });

  initSocket(io);

  const HOST = process.env.HOST || '0.0.0.0';
  server.listen(PORT, HOST, () => {
    console.log(`=======================================================`);
    console.log(`⚓ AnchorTrack Order & Payment System is Live!`);
    console.log(`🏖️ Location: Ramapuram Beach, Chirala (Choramandal Coast)`);
    console.log(`🌐 Live Server: http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
    console.log(`📱 Waiter & Cashier POS:  http://localhost:${PORT}/pos`);
    console.log(`📍 Customer Live Tracker: http://localhost:${PORT}/track`);
    console.log(`📊 Management Analytics:  http://localhost:${PORT}/admin/analytics`);
    console.log(`=======================================================`);
  });

  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Failed to start AnchorTrack server:', err);
    process.exit(1);
  });
}

module.exports = { startServer };
