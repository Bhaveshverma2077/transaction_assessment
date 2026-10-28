const mongoose = require('mongoose');
const { generateAccountId } = require('../utils/idGenerator');

const accountSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      default: generateAccountId,
    },
    name: {
      type: String,
      required: [true, 'Account holder name is required'],
      trim: true,
      minlength: [1, 'Name cannot be empty'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    balance: {
      type: Number,
      required: true,
      default: 0,
      min: [0, 'Account balance cannot be negative'],
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
          name: ret.name,
          balance: Number(ret.balance.toFixed(2)),
          created_at: ret.created_at,
        };
      },
    },
  }
);

const Account = mongoose.model('Account', accountSchema);

module.exports = Account;
