const mongoose = require('mongoose');
const env = require('./env');

let isReplicaSet = false;

const connectDB = async (uri = env.MONGODB_URI) => {
  try {
    const conn = await mongoose.connect(uri);
    console.log(`[Database] MongoDB connected: ${conn.connection.host}:${conn.connection.port}/${conn.connection.name}`);

    // Detect if connected cluster is a replica set (supports multi-document transactions)
    try {
      const admin = conn.connection.db.admin();
      const status = await admin.serverStatus();
      isReplicaSet = Boolean(status.repl && status.repl.setName);
      console.log(`[Database] Topology: ${isReplicaSet ? `Replica Set (${status.repl.setName})` : 'Standalone'}`);
    } catch (e) {
      isReplicaSet = false;
      console.log('[Database] Topology detection fallback: Standalone');
    }

    return conn;
  } catch (error) {
    console.error(`[Database] MongoDB connection error: ${error.message}`);
    throw error;
  }
};

const disconnectDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    console.log('[Database] MongoDB disconnected cleanly');
  }
};

const getIsReplicaSet = () => isReplicaSet;

module.exports = {
  connectDB,
  disconnectDB,
  getIsReplicaSet,
  mongoose,
};
