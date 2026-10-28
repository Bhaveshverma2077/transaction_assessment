const express = require('express');
const router = express.Router();

const transferController = require('../controllers/transferController');
const validate = require('../middleware/validate');
const { transferFundsSchema } = require('../validators/transferValidator');

// Bonus: Money transfer between accounts
router.post('/', validate(transferFundsSchema, 'body'), transferController.transferFunds);

module.exports = router;
