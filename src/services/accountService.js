const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/apiError');
const { ERROR_CODES } = require('../constants/errorCodes');
const { roundToTwoDecimals } = require('../utils/mathUtils');

class AccountService {
  /**
   * Create a new account with guaranteed initial balance of 0
   */
  async createAccount(data) {
    const { name } = data;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw ApiError.badRequest('Account name is required', ERROR_CODES.VALIDATION_ERROR);
    }

    const trimmedName = name.trim();

    const account = await Account.create({
      name: trimmedName,
      balance: 0,
    });

    return account;
  }

  /**
   * Retrieve account by ID
   */
  async getAccountById(accountId, session = null) {
    if (!accountId || typeof accountId !== 'string') {
      throw ApiError.badRequest('Account ID must be a non-empty string', ERROR_CODES.VALIDATION_ERROR);
    }

    const query = Account.findOne({ id: accountId });
    if (session) {
      query.session(session);
    }

    const account = await query.exec();
    if (!account) {
      throw ApiError.notFound(
        `Account with ID '${accountId}' does not exist`,
        ERROR_CODES.ACCOUNT_NOT_FOUND
      );
    }

    return account;
  }

  /**
   * Retrieve current balance of an account
   */
  async getAccountBalance(accountId) {
    const account = await this.getAccountById(accountId);

    return {
      account_id: account.id,
      balance: Number(account.balance.toFixed(2)),
      name: account.name,
      created_at: account.created_at,
    };
  }

  /**
   * Verify consistency of account balance by summing all valid transactions
   */
  async verifyAccountBalance(accountId) {
    const account = await this.getAccountById(accountId);

    const transactions = await Transaction.find({ account_id: accountId }).exec();

    let calculatedBalance = 0;
    for (const txn of transactions) {
      if (txn.type === 'credit') {
        calculatedBalance += txn.amount;
      } else if (txn.type === 'debit') {
        calculatedBalance -= txn.amount;
      }
    }

    calculatedBalance = roundToTwoDecimals(calculatedBalance);
    const storedBalance = roundToTwoDecimals(account.balance);

    return {
      account_id: account.id,
      stored_balance: storedBalance,
      calculated_balance: calculatedBalance,
      is_consistent: storedBalance === calculatedBalance,
      transaction_count: transactions.length,
    };
  }
}

module.exports = new AccountService();
