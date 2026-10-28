const transactionService = require('../services/transactionService');
const ApiResponse = require('../utils/apiResponse');
const ApiError = require('../utils/apiError');
const { ERROR_CODES } = require('../constants/errorCodes');

class TransactionController {
  async addTransaction(req, res, next) {
    try {
      const accountId = req.params.accountId || req.body.account_id;

      if (!accountId) {
        throw ApiError.badRequest(
          'Account ID must be provided either in the URL path (:accountId) or request body (account_id)',
          ERROR_CODES.VALIDATION_ERROR
        );
      }

      const result = await transactionService.addTransaction({
        accountId,
        type: req.body.type,
        amount: req.body.amount,
        description: req.body.description,
        referenceId: req.body.reference_id,
      });

      return ApiResponse.created(
        res,
        result.transaction,
        'Transaction created successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  async getTransactionHistory(req, res, next) {
    try {
      const accountId = req.params.accountId;
      const { type, page, limit } = req.query;

      const result = await transactionService.getTransactionHistory({
        accountId,
        type,
        page,
        limit,
      });

      return ApiResponse.paginated(
        res,
        result.items,
        result.pagination,
        'Transaction history retrieved successfully'
      );
    } catch (error) {
      next(error);
    }
  }

  rejectModification(req, res, next) {
    next(
      ApiError.methodNotAllowed(
        `Transactions are immutable. ${req.method} operations are strictly forbidden on transactions.`,
        ERROR_CODES.RESOURCE_IMMUTABLE
      )
    );
  }
}

module.exports = new TransactionController();
