const { ERROR_CODES } = require('../constants/errorCodes');

class ApiError extends Error {
  constructor(statusCode, message, errorCode = ERROR_CODES.INTERNAL_SERVER_ERROR, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message, errorCode = ERROR_CODES.VALIDATION_ERROR, details = null) {
    return new ApiError(400, message, errorCode, details);
  }

  static notFound(message = 'Resource not found', errorCode = ERROR_CODES.ACCOUNT_NOT_FOUND) {
    return new ApiError(404, message, errorCode);
  }

  static conflict(message, errorCode = ERROR_CODES.DUPLICATE_TRANSACTION, details = null) {
    return new ApiError(409, message, errorCode, details);
  }

  static unprocessable(message, errorCode = ERROR_CODES.INSUFFICIENT_BALANCE, details = null) {
    return new ApiError(422, message, errorCode, details);
  }

  static methodNotAllowed(message = 'Method not allowed for this resource', errorCode = ERROR_CODES.METHOD_NOT_ALLOWED) {
    return new ApiError(405, message, errorCode);
  }

  static internal(message = 'Internal server error') {
    return new ApiError(500, message, ERROR_CODES.INTERNAL_SERVER_ERROR);
  }
}

module.exports = ApiError;
