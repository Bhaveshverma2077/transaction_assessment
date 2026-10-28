const transferService = require('../services/transferService');
const ApiResponse = require('../utils/apiResponse');

class TransferController {
  async transferFunds(req, res, next) {
    try {
      const { from_account_id, to_account_id, amount, description, reference_id } = req.body;

      const result = await transferService.transferFunds({
        fromAccountId: from_account_id,
        toAccountId: to_account_id,
        amount,
        description,
        referenceId: reference_id,
      });

      return ApiResponse.created(res, result, 'Funds transferred successfully');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new TransferController();
