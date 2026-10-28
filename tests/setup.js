const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { connectDB, disconnectDB } = require('../src/config/database');

let mongoServer;

beforeAll(async () => {
  process.env.NODE_ENV = 'test';
  let uri = process.env.MONGODB_TEST_URI;
  if (!uri) {
    try {
      mongoServer = await MongoMemoryServer.create();
      uri = mongoServer.getUri();
    } catch (e) {
      uri = 'mongodb://127.0.0.1:27017/transaction_ledger_test';
    }
  }

  await connectDB(uri);
  // Ensure indexes are built
  await Promise.all(
    Object.values(mongoose.connection.models).map((model) => model.createIndexes())
  );
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await disconnectDB();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

