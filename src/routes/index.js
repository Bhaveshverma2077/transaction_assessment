const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');

const accountRoutes = require('./accountRoutes');
const transactionRoutes = require('./transactionRoutes');
const transferRoutes = require('./transferRoutes');
const { getIsReplicaSet } = require('../config/database');

// Health check endpoint
router.get('/health', (req, res) => {
  const isDbConnected = mongoose.connection.readyState === 1;
  res.status(isDbConnected ? 200 : 503).json({
    success: isDbConnected,
    status: isDbConnected ? 'UP' : 'DOWN',
    timestamp: new Date().toISOString(),
    database: {
      connected: isDbConnected,
      topology: getIsReplicaSet() ? 'replica_set' : 'standalone',
    },
  });
});

router.use('/accounts', accountRoutes);
router.use('/transactions', transactionRoutes);
router.use('/transfers', transferRoutes);

module.exports = router;
