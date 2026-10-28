const Account = require('../models/Account');
const Transaction = require('../models/Transaction');
const Transfer = require('../models/Transfer');
const ApiError = require('../utils/apiError');
const { ERROR_CODES } = require('../constants/errorCodes');
const { TRANSACTION_TYPES } = require('../constants/transactionTypes');
const { roundToTwoDecimals } = require('../utils/mathUtils');
const { runInTransaction } = require('../utils/transactionExecutor');

class TransferService {
  /**
   * Transfer funds from one account to another atomically
   */
  async transferFunds(data) {
    const { fromAccountId, toAccountId, amount, description = '', referenceId } = data;

    if (!fromAccountId || typeof fromAccountId !== 'string') {
      throw ApiError.badRequest('from_account_id is required', ERROR_CODES.VALIDATION_ERROR);
    }
    if (!toAccountId || typeof toAccountId !== 'string') {
      throw ApiError.badRequest('to_account_id is required', ERROR_CODES.VALIDATION_ERROR);
    }
    if (fromAccountId === toAccountId) {
      throw ApiError.badRequest('Cannot transfer funds to the same account', ERROR_CODES.TRANSFER_SAME_ACCOUNT);
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      throw ApiError.badRequest(
        'Transfer amount must be a positive number greater than 0',
        ERROR_CODES.INVALID_AMOUNT
      );
    }
    const roundedAmount = roundToTwoDecimals(parsedAmount);

    if (!referenceId || typeof referenceId !== 'string' || referenceId.trim().length === 0) {
      throw ApiError.badRequest('reference_id is required and must not be empty', ERROR_CODES.VALIDATION_ERROR);
    }
    const trimmedRefId = referenceId.trim();

    return await runInTransaction(async (session) => {
      // 1. Check existing transfer with this reference_id
      const existingTransferQuery = Transfer.findOne({ reference_id: trimmedRefId });
      if (session) existingTransferQuery.session(session);
      const existingTransfer = await existingTransferQuery.exec();

      if (existingTransfer) {
        throw ApiError.conflict(
          `Transfer with reference_id '${trimmedRefId}' already exists`,
          ERROR_CODES.DUPLICATE_TRANSACTION,
          { reference_id: trimmedRefId, transfer_id: existingTransfer.id }
        );
      }

      // 2. Fetch both accounts
      const fromQuery = Account.findOne({ id: fromAccountId });
      const toQuery = Account.findOne({ id: toAccountId });
      if (session) {
        fromQuery.session(session);
        toQuery.session(session);
      }

      const [fromAccount, toAccount] = await Promise.all([fromQuery.exec(), toQuery.exec()]);

      if (!fromAccount) {
        throw ApiError.notFound(
          `Source account with ID '${fromAccountId}' does not exist`,
          ERROR_CODES.ACCOUNT_NOT_FOUND
        );
      }
      if (!toAccount) {
        throw ApiError.notFound(
          `Destination account with ID '${toAccountId}' does not exist`,
          ERROR_CODES.ACCOUNT_NOT_FOUND
        );
      }

      // 3. Verify sufficient balance in source account
      const fromCurrentBalance = roundToTwoDecimals(fromAccount.balance);
      if (fromCurrentBalance < roundedAmount) {
        throw ApiError.unprocessable(
          `Insufficient balance for transfer. Source account balance is ${fromCurrentBalance}, requested transfer is ${roundedAmount}`,
          ERROR_CODES.INSUFFICIENT_BALANCE,
          {
            current_balance: fromCurrentBalance,
            requested_amount: roundedAmount,
            shortfall: roundToTwoDecimals(roundedAmount - fromCurrentBalance),
          }
        );
      }

      const newFromBalance = roundToTwoDecimals(fromAccount.balance - roundedAmount);
      const newToBalance = roundToTwoDecimals(toAccount.balance + roundedAmount);
      const transferDesc = description ? description.trim() : `Transfer from ${fromAccountId} to ${toAccountId}`;

      if (session) {
        // --- Replica Set Mode (ACID multi-document session) ---
        fromAccount.balance = newFromBalance;
        toAccount.balance = newToBalance;
        await Promise.all([fromAccount.save({ session }), toAccount.save({ session })]);

        const [debitTxn] = await Transaction.create(
          [
            {
              account_id: fromAccountId,
              type: TRANSACTION_TYPES.DEBIT,
              amount: roundedAmount,
              description: `Transfer debit: ${transferDesc}`,
              reference_id: `${trimmedRefId}_dr`,
              balance_after: newFromBalance,
            },
          ],
          { session }
        );

        const [creditTxn] = await Transaction.create(
          [
            {
              account_id: toAccountId,
              type: TRANSACTION_TYPES.CREDIT,
              amount: roundedAmount,
              description: `Transfer credit: ${transferDesc}`,
              reference_id: `${trimmedRefId}_cr`,
              balance_after: newToBalance,
            },
          ],
          { session }
        );

        const [transferDoc] = await Transfer.create(
          [
            {
              from_account_id: fromAccountId,
              to_account_id: toAccountId,
              amount: roundedAmount,
              description: transferDesc,
              reference_id: trimmedRefId,
              debit_transaction_id: debitTxn.id,
              credit_transaction_id: creditTxn.id,
            },
          ],
          { session }
        );

        return {
          transfer: transferDoc,
          from_account: {
            id: fromAccount.id,
            new_balance: newFromBalance,
          },
          to_account: {
            id: toAccount.id,
            new_balance: newToBalance,
          },
        };
      } else {
        // --- Standalone Mode (Atomic conditional updates + compensating rollback) ---
        const updatedFrom = await Account.findOneAndUpdate(
          { id: fromAccountId, balance: { $gte: roundedAmount } },
          { $inc: { balance: -roundedAmount } },
          { returnDocument: 'after' }
        );

        if (!updatedFrom) {
          throw ApiError.unprocessable(
            `Insufficient balance for transfer. Requested amount: ${roundedAmount}`,
            ERROR_CODES.INSUFFICIENT_BALANCE
          );
        }

        let updatedTo;
        try {
          updatedTo = await Account.findOneAndUpdate(
            { id: toAccountId },
            { $inc: { balance: roundedAmount } },
            { returnDocument: 'after' }
          );

          if (!updatedTo) {
            // Revert fromAccount
            await Account.updateOne({ id: fromAccountId }, { $inc: { balance: roundedAmount } });
            throw ApiError.notFound(
              `Destination account with ID '${toAccountId}' does not exist`,
              ERROR_CODES.ACCOUNT_NOT_FOUND
            );
          }

          const debitTxn = await Transaction.create({
            account_id: fromAccountId,
            type: TRANSACTION_TYPES.DEBIT,
            amount: roundedAmount,
            description: `Transfer debit: ${transferDesc}`,
            reference_id: `${trimmedRefId}_dr`,
            balance_after: roundToTwoDecimals(updatedFrom.balance),
          });

          const creditTxn = await Transaction.create({
            account_id: toAccountId,
            type: TRANSACTION_TYPES.CREDIT,
            amount: roundedAmount,
            description: `Transfer credit: ${transferDesc}`,
            reference_id: `${trimmedRefId}_cr`,
            balance_after: roundToTwoDecimals(updatedTo.balance),
          });

          const transferDoc = await Transfer.create({
            from_account_id: fromAccountId,
            to_account_id: toAccountId,
            amount: roundedAmount,
            description: transferDesc,
            reference_id: trimmedRefId,
            debit_transaction_id: debitTxn.id,
            credit_transaction_id: creditTxn.id,
          });

          return {
            transfer: transferDoc,
            from_account: {
              id: updatedFrom.id,
              new_balance: roundToTwoDecimals(updatedFrom.balance),
            },
            to_account: {
              id: updatedTo.id,
              new_balance: roundToTwoDecimals(updatedTo.balance),
            },
          };
        } catch (innerError) {
          // Compensating rollback
          await Account.updateOne({ id: fromAccountId }, { $inc: { balance: roundedAmount } });
          if (updatedTo) {
            await Account.updateOne({ id: toAccountId }, { $inc: { balance: -roundedAmount } });
          }
          throw innerError;
        }
      }
    });
  }
}

module.exports = new TransferService();
