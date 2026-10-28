const express = require('express');
const router = express.Router();

const accountController = require('../controllers/accountController');
const transactionController = require('../controllers/transactionController');

const validate = require('../middleware/validate');
const { createAccountSchema } = require('../validators/accountValidator');
const {
  addTransactionSchema,
  getTransactionHistoryQuerySchema,
} = require('../validators/transactionValidator');

// Account operations
router.post('/', validate(createAccountSchema, 'body'), accountController.createAccount);
router.get('/:accountId', accountController.getAccountById);
router.get('/:accountId/balance', accountController.getAccountBalance);
router.get('/:accountId/verify-balance', accountController.verifyBalance);

// Account-nested transaction operations
router.post(
  '/:accountId/transactions',
  validate(addTransactionSchema, 'body'),
  transactionController.addTransaction
);
router.get(
  '/:accountId/transactions',
  validate(getTransactionHistoryQuerySchema, 'query'),
  transactionController.getTransactionHistory
);

// Immutability enforcement on nested transaction routes
router.put('/:accountId/transactions', transactionController.rejectModification);
router.put('/:accountId/transactions/:transactionId', transactionController.rejectModification);
router.patch('/:accountId/transactions', transactionController.rejectModification);
router.patch('/:accountId/transactions/:transactionId', transactionController.rejectModification);
router.delete('/:accountId/transactions', transactionController.rejectModification);
router.delete('/:accountId/transactions/:transactionId', transactionController.rejectModification);

module.exports = router;
