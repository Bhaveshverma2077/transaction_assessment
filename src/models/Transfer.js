const mongoose = require('mongoose');
const { generateTransferId } = require('../utils/idGenerator');

const transferSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: generateTransferId,
      immutable: true,
    },
    from_account_id: {
      type: String,
      required: [true, 'Source account ID is required'],
      index: true,
      immutable: true,
    },
    to_account_id: {
      type: String,
      required: [true, 'Destination account ID is required'],
      index: true,
      immutable: true,
    },
    amount: {
      type: Number,
      required: [true, 'Transfer amount is required'],
      min: [0.01, 'Transfer amount must be greater than 0'],
      immutable: true,
    },
    description: {
      type: String,
      trim: true,
      default: 'Account transfer',
      immutable: true,
    },
    reference_id: {
      type: String,
      required: [true, 'reference_id is required'],
      trim: true,
      immutable: true,
    },
    debit_transaction_id: {
      type: String,
      required: true,
      immutable: true,
    },
    credit_transaction_id: {
      type: String,
      required: true,
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
        return {
          id: ret.id,
          from_account_id: ret.from_account_id,
          to_account_id: ret.to_account_id,
          amount: Number(ret.amount.toFixed(2)),
          description: ret.description,
          reference_id: ret.reference_id,
          debit_transaction_id: ret.debit_transaction_id,
          credit_transaction_id: ret.credit_transaction_id,
          created_at: ret.created_at,
        };
      },
    },
  }
);

transferSchema.index({ reference_id: 1 }, { unique: true });
transferSchema.index({ from_account_id: 1, created_at: -1 });
transferSchema.index({ to_account_id: 1, created_at: -1 });

const Transfer = mongoose.model('Transfer', transferSchema);

module.exports = Transfer;
