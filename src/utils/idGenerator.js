const crypto = require('crypto');

const generateAccountId = () => {
  return `acc_${crypto.randomUUID()}`;
};

const generateTransactionId = () => {
  return `txn_${crypto.randomUUID()}`;
};

const generateTransferId = () => {
  return `trf_${crypto.randomUUID()}`;
};

module.exports = {
  generateAccountId,
  generateTransactionId,
  generateTransferId,
};
