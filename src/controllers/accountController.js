const accountService = require('../services/accountService');
const ApiResponse = require('../utils/apiResponse');

class AccountController {
  async createAccount(req, res, next) {
    try {
      const account = await accountService.createAccount(req.body);
      return ApiResponse.created(res, account, 'Account created successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAccountBalance(req, res, next) {
    try {
      const accountId = req.params.accountId;
      const balanceData = await accountService.getAccountBalance(accountId);
      return ApiResponse.success(res, balanceData, 'Account balance retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async getAccountById(req, res, next) {
    try {
      const accountId = req.params.accountId;
      const account = await accountService.getAccountById(accountId);
      return ApiResponse.success(res, account, 'Account retrieved successfully');
    } catch (error) {
      next(error);
    }
  }

  async verifyBalance(req, res, next) {
    try {
      const accountId = req.params.accountId;
      const auditResult = await accountService.verifyAccountBalance(accountId);
      return ApiResponse.success(res, auditResult, 'Account balance audit completed');
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AccountController();
