const mongoose = require('mongoose');

let memoryServerInstance = null;

const connectDB = async () => {
  const uri = process.env.MONGODB_URI;
  const isPlaceholderUri = !uri || uri.includes('<password>') || uri.includes('cluster0.abcde.mongodb.net');

  // If valid MongoDB URI provided, try connecting to Atlas/remote cluster
  if (!isPlaceholderUri) {
    try {
      const conn = await mongoose.connect(uri, {
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
      });

      console.log(`🌊 [AnchorTrack DB] Connected successfully to MongoDB: ${conn.connection.host}`);
      console.log(`📍 Database Selected: ${conn.connection.name}`);
      return conn;
    } catch (error) {
      console.warn(`⚠️ [AnchorTrack DB] Could not connect to configured MONGODB_URI: ${error.message}`);
      console.log('🔄 [AnchorTrack DB] Falling back to automated in-memory MongoDB instance for local zero-config operation...');
    }
  } else {
    console.log('ℹ️ [AnchorTrack DB] Placeholder or missing MONGODB_URI detected.');
    console.log('⚡ [AnchorTrack DB] Initializing local MongoMemoryServer for instant zero-setup development...');
  }

  // Fallback to MongoMemoryServer so the app runs out-of-the-box smoothly
  try {
    const { MongoMemoryServer } = require('mongodb-memory-server');
    memoryServerInstance = await MongoMemoryServer.create();
    const memUri = memoryServerInstance.getUri();

    const conn = await mongoose.connect(memUri);
    console.log(`✅ [AnchorTrack DB] Local In-Memory MongoDB connected: ${memUri}`);
    console.log('💡 [AnchorTrack DB] Tip: To connect to cloud MongoDB Atlas, update MONGODB_URI in your .env file.');
    return conn;
  } catch (memErr) {
    console.error(`❌ [AnchorTrack DB] Fatal Error starting database: ${memErr.message}`);
    process.exit(1);
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️ [AnchorTrack DB] Lost MongoDB connection! Attempting reconnect...');
});

mongoose.connection.on('reconnected', () => {
  console.log('✅ [AnchorTrack DB] Re-established connection to MongoDB Atlas.');
});

const closeDB = async () => {
  await mongoose.disconnect();
  if (memoryServerInstance) {
    await memoryServerInstance.stop();
  }
};

module.exports = {
  connectDB,
  closeDB
};
