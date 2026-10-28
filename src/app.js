const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const routes = require('./routes');
const requestLogger = require('./middleware/requestLogger');
const notFoundHandler = require('./middleware/notFoundHandler');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// Security and utility middleware
app.use(helmet());
app.use(cors());
app.use(requestLogger);
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Root metadata endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Transaction Ledger API',
    version: '1.0.0',
    documentation: '/api/v1/health',
    endpoints: {
      create_account: 'POST /api/v1/accounts',
      get_account: 'GET /api/v1/accounts/:accountId',
      get_balance: 'GET /api/v1/accounts/:accountId/balance',
      verify_balance: 'GET /api/v1/accounts/:accountId/verify-balance',
      add_transaction: 'POST /api/v1/accounts/:accountId/transactions (or POST /api/v1/transactions)',
      get_transactions: 'GET /api/v1/accounts/:accountId/transactions?type=credit|debit&page=1&limit=10',
      transfer_funds: 'POST /api/v1/transfers',
      health_check: 'GET /api/v1/health',
    },
  });
});

// Mount routes on /api/v1 and /api
app.use('/api/v1', routes);
app.use('/api', routes);

// 404 and global error handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
