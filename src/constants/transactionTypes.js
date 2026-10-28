const TRANSACTION_TYPES = Object.freeze({
  CREDIT: 'credit',
  DEBIT: 'debit',
});

const ALLOWED_TRANSACTION_TYPES = Object.values(TRANSACTION_TYPES);

const TRANSFER_STATUS = Object.freeze({
  COMPLETED: 'completed',
  FAILED: 'failed',
});

module.exports = {
  TRANSACTION_TYPES,
  ALLOWED_TRANSACTION_TYPES,
  TRANSFER_STATUS,
};
