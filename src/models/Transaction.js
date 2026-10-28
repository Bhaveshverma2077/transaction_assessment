const mongoose = require('mongoose');
const { generateTransactionId } = require('../utils/idGenerator');
const { TRANSACTION_TYPES, ALLOWED_TRANSACTION_TYPES } = require('../constants/transactionTypes');

const transactionSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: generateTransactionId,
      immutable: true,
    },
    account_id: {
      type: String,
      required: [true, 'Account ID is required'],
      index: true,
      immutable: true,
    },
    type: {
      type: String,
      required: [true, 'Transaction type is required'],
      enum: {
        values: ALLOWED_TRANSACTION_TYPES,
        message: 'Transaction type must be either credit or debit',
      },
      immutable: true,
    },
    amount: {
      type: Number,
      required: [true, 'Transaction amount is required'],
      min: [0.01, 'Amount must be greater than 0'],
      immutable: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
      immutable: true,
    },
    reference_id: {
      type: String,
      required: [true, 'reference_id is required'],
      trim: true,
      immutable: true,
    },
    balance_after: {
      type: Number,
      required: false,
      immutable: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
      immutable: true,
    },
  },
  {
    timestamps: false,
    versionKey: false,
    toJSON: {
      transform: (doc, ret) => {
        const response = {
          id: ret.id,
          account_id: ret.account_id,
          type: ret.type,
          amount: Number(ret.amount.toFixed(2)),
          description: ret.description,
          reference_id: ret.reference_id,
          created_at: ret.created_at,
        };
        if (ret.balance_after !== undefined) {
          response.balance_after = Number(ret.balance_after.toFixed(2));
        }
        return response;
      },
    },
  }
);

// Compound unique index: reference_id must be unique per account
transactionSchema.index({ account_id: 1, reference_id: 1 }, { unique: true });

// Compound index for querying latest transactions by account
transactionSchema.index({ account_id: 1, created_at: -1 });

// Compound index for filtering by account and type
transactionSchema.index({ account_id: 1, type: 1, created_at: -1 });

// Immutability enforcement: Block updates and deletions
const preventModification = function (next) {
  const err = new Error('Transactions are immutable and cannot be updated or deleted');
  err.name = 'ImmutableResourceError';
  return next(err);
};

transactionSchema.pre('updateOne', preventModification);
transactionSchema.pre('updateMany', preventModification);
transactionSchema.pre('findOneAndUpdate', preventModification);
transactionSchema.pre('deleteOne', preventModification);
transactionSchema.pre('deleteMany', preventModification);
transactionSchema.pre('findOneAndDelete', preventModification);

const Transaction = mongoose.model('Transaction', transactionSchema);

module.exports = Transaction;
