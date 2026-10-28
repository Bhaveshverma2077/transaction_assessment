const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const ApiError = require('../utils/apiError');
const { ERROR_CODES } = require('../constants/errorCodes');
const { TRANSACTION_TYPES, ALLOWED_TRANSACTION_TYPES } = require('../constants/transactionTypes');
const { roundToTwoDecimals } = require('../utils/mathUtils');
const { runInTransaction } = require('../utils/transactionExecutor');

class TransactionService {
  /**
   * Add a transaction (credit or debit) to an account atomically
   */
  async addTransaction(data) {
    const { accountId, type, amount, description = '', referenceId } = data;

    // Normalize inputs
    const normalizedType = typeof type === 'string' ? type.trim().toLowerCase() : '';
    if (!ALLOWED_TRANSACTION_TYPES.includes(normalizedType)) {
      throw ApiError.badRequest(
        `Invalid transaction type '${type}'. Allowed types are: ${ALLOWED_TRANSACTION_TYPES.join(', ')}`,
        ERROR_CODES.INVALID_TRANSACTION_TYPE
      );
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw ApiError.badRequest(
        'Transaction amount must be a valid positive number greater than 0',
        ERROR_CODES.INVALID_AMOUNT
      );
    }
    const roundedAmount = roundToTwoDecimals(parsedAmount);

    if (!referenceId || typeof referenceId !== 'string' || referenceId.trim().length === 0) {
      throw ApiError.badRequest('reference_id is required and must not be empty', ERROR_CODES.VALIDATION_ERROR);
    }
    const trimmedReferenceId = referenceId.trim();

    return await runInTransaction(async (session) => {
      // 1. Check if account exists
      const accountQuery = Account.findOne({ id: accountId });
      if (session) accountQuery.session(session);
      const account = await accountQuery.exec();

      if (!account) {
        throw ApiError.notFound(
          `Account with ID '${accountId}' does not exist`,
          ERROR_CODES.ACCOUNT_NOT_FOUND
        );
      }

      // 2. Check for duplicate reference_id within the same account
      const existingTxnQuery = Transaction.findOne({
        account_id: accountId,
        reference_id: trimmedReferenceId,
      });
      if (session) existingTxnQuery.session(session);
      const existingTxn = await existingTxnQuery.exec();

      if (existingTxn) {
        throw ApiError.conflict(
          `Transaction with reference_id '${trimmedReferenceId}' already exists for account '${accountId}'`,
          ERROR_CODES.DUPLICATE_TRANSACTION,
          {
            reference_id: trimmedReferenceId,
            existing_transaction_id: existingTxn.id,
            account_id: accountId,
          }
        );
      }

      // 3. For debit, verify balance sufficiency
      if (normalizedType === TRANSACTION_TYPES.DEBIT) {
        const currentBalance = roundToTwoDecimals(account.balance);
        if (currentBalance < roundedAmount) {
          throw ApiError.unprocessable(
            `Insufficient balance. Account balance is ${currentBalance}, requested debit amount is ${roundedAmount}`,
            ERROR_CODES.INSUFFICIENT_BALANCE,
            {
              current_balance: currentBalance,
              requested_amount: roundedAmount,
              shortfall: roundToTwoDecimals(roundedAmount - currentBalance),
            }
          );
        }
      }

      // 4. Calculate new balance
      const balanceDelta = normalizedType === TRANSACTION_TYPES.CREDIT ? roundedAmount : -roundedAmount;
      const expectedNewBalance = roundToTwoDecimals(account.balance + balanceDelta);

      if (session) {
        // --- Replica Set Mode (ACID multi-document session) ---
        account.balance = expectedNewBalance;
        await account.save({ session });

        const [createdTransaction] = await Transaction.create(
          [
            {
              account_id: accountId,
              type: normalizedType,
              amount: roundedAmount,
              description: description ? description.trim() : `${normalizedType.toUpperCase()} transaction`,
              reference_id: trimmedReferenceId,
              balance_after: expectedNewBalance,
            },
          ],
          { session }
        );

        return {
          transaction: createdTransaction,
          account_id: account.id,
          new_balance: expectedNewBalance,
        };
      } else {
        // --- Standalone Mode (Atomic conditional updates + compensating rollback) ---
        let updatedAccount;
        if (normalizedType === TRANSACTION_TYPES.DEBIT) {
          updatedAccount = await Account.findOneAndUpdate(
            { id: accountId, balance: { $gte: roundedAmount } },
            { $inc: { balance: -roundedAmount } },
            { returnDocument: 'after' }
          );
          if (!updatedAccount) {
            // Re-fetch to distinguish account not found vs insufficient balance
            const freshAccount = await Account.findOne({ id: accountId });
            if (!freshAccount) {
              throw ApiError.notFound(`Account with ID '${accountId}' does not exist`, ERROR_CODES.ACCOUNT_NOT_FOUND);
            }
            throw ApiError.unprocessable(
              `Insufficient balance. Account balance is ${roundToTwoDecimals(freshAccount.balance)}, requested debit amount is ${roundedAmount}`,
              ERROR_CODES.INSUFFICIENT_BALANCE
            );
          }
        } else {
          updatedAccount = await Account.findOneAndUpdate(
            { id: accountId },
            { $inc: { balance: roundedAmount } },
            { returnDocument: 'after' }
          );
        }

        const calculatedBalanceAfter = roundToTwoDecimals(updatedAccount.balance);

        try {
          const createdTransaction = await Transaction.create({
            account_id: accountId,
            type: normalizedType,
            amount: roundedAmount,
            description: description ? description.trim() : `${normalizedType.toUpperCase()} transaction`,
            reference_id: trimmedReferenceId,
            balance_after: calculatedBalanceAfter,
          });

          return {
            transaction: createdTransaction,
            account_id: updatedAccount.id,
            new_balance: calculatedBalanceAfter,
          };
        } catch (txnError) {
          // Compensating rollback for standalone mode
          const revertDelta = -balanceDelta;
          await Account.updateOne({ id: accountId }, { $inc: { balance: revertDelta } });

          if (txnError.code === 11000) {
            throw ApiError.conflict(
              `Transaction with reference_id '${trimmedReferenceId}' already exists for account '${accountId}'`,
              ERROR_CODES.DUPLICATE_TRANSACTION
            );
          }
          throw txnError;
        }
      }
    });
  }

  /**
   * Fetch transaction history for an account with filtering, pagination, and latest-first sorting
   */
  async getTransactionHistory(params) {
    const { accountId, type, page = 1, limit = 10 } = params;

    if (!accountId || typeof accountId !== 'string') {
      throw ApiError.badRequest('Account ID must be a non-empty string', ERROR_CODES.VALIDATION_ERROR);
    }

    // Verify account exists
    const account = await Account.findOne({ id: accountId });
    if (!account) {
      throw ApiError.notFound(
        `Account with ID '${accountId}' does not exist`,
        ERROR_CODES.ACCOUNT_NOT_FOUND
      );
    }

    // Build filter query
    const query = { account_id: accountId };

    if (type !== undefined && type !== null && type !== '') {
      const normalizedType = typeof type === 'string' ? type.trim().toLowerCase() : '';
      if (!ALLOWED_TRANSACTION_TYPES.includes(normalizedType)) {
        throw ApiError.badRequest(
          `Invalid filter type '${type}'. Allowed values: ${ALLOWED_TRANSACTION_TYPES.join(', ')}`,
          ERROR_CODES.INVALID_TRANSACTION_TYPE
        );
      }
      query.type = normalizedType;
    }

    // Parse and validate pagination
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (parsedPage - 1) * parsedLimit;

    // Execute count and query in parallel
    const [totalRecords, transactions] = await Promise.all([
      Transaction.countDocuments(query),
      Transaction.find(query)
        .sort({ created_at: -1 }) // Latest-first order
        .skip(skip)
        .limit(parsedLimit)
        .exec(),
    ]);

    const totalPages = Math.ceil(totalRecords / parsedLimit) || 1;

    return {
      items: transactions,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        totalRecords,
        totalPages,
      },
    };
  }
}

module.exports = new TransactionService();
