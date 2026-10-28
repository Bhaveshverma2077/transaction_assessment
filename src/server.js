const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/database');

let server;

const startServer = async () => {
  try {
    await connectDB();

    server = app.listen(env.PORT, () => {
      console.log(`[Server] Transaction Ledger API is running on port ${env.PORT} in ${env.NODE_ENV} mode`);
      console.log(`[Server] Health check: http://localhost:${env.PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error(`[Server] Failed to start server: ${error.message}`);
    process.exit(1);
  }
};

const gracefulShutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
  if (server) {
    server.close(async () => {
      console.log('[Server] HTTP server closed');
      await disconnectDB();
      process.exit(0);
    });
  } else {
    await disconnectDB();
    process.exit(0);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Server] Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Server] Uncaught Exception:', error);
  process.exit(1);
});

startServer();
