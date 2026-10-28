const express = require('express');
const router = express.Router();

const transactionController = require('../controllers/transactionController');
const validate = require('../middleware/validate');
const { addTransactionSchema } = require('../validators/transactionValidator');

// Direct transaction creation (account_id in body)
router.post('/', validate(addTransactionSchema, 'body'), transactionController.addTransaction);

// Immutability enforcement on top-level transaction routes
router.put('/', transactionController.rejectModification);
router.put('/:id', transactionController.rejectModification);
router.patch('/', transactionController.rejectModification);
router.patch('/:id', transactionController.rejectModification);
router.delete('/', transactionController.rejectModification);
router.delete('/:id', transactionController.rejectModification);

module.exports = router;
