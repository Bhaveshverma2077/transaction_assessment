const ApiError = require('../utils/apiError');
const { ERROR_CODES } = require('../constants/errorCodes');

const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle SyntaxError for bad JSON request bodies
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    error = ApiError.badRequest('Malformed JSON in request body', ERROR_CODES.VALIDATION_ERROR);
  }

  // Handle Mongoose / Schema Immutability error
  if (err.name === 'ImmutableResourceError') {
    error = ApiError.methodNotAllowed(err.message, ERROR_CODES.RESOURCE_IMMUTABLE);
  }

  // Handle Mongo duplicate key error (E11000)
  if (err.code === 11000) {
    const keyPattern = Object.keys(err.keyPattern || {}).join(', ');
    error = ApiError.conflict(
      `Duplicate record detected for: ${keyPattern || 'unique field'}`,
      ERROR_CODES.DUPLICATE_TRANSACTION,
      err.keyValue
    );
  }

  // Handle Mongoose Validation Error
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    error = ApiError.badRequest('Schema validation failed', ERROR_CODES.VALIDATION_ERROR, details);
  }

  // Handle Mongoose CastError (e.g. invalid ObjectId or number)
  if (err.name === 'CastError') {
    error = ApiError.badRequest(`Invalid value for field '${err.path}'`, ERROR_CODES.VALIDATION_ERROR);
  }

  // Default to internal error if not an ApiError instance
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || 500;
    const message = error.message || 'Internal server error';
    error = new ApiError(statusCode, message, ERROR_CODES.INTERNAL_SERVER_ERROR);
  }

  const statusCode = error.statusCode || 500;
  const responsePayload = {
    success: false,
    error: {
      code: error.errorCode || ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    },
  };

  if (process.env.NODE_ENV === 'development' && statusCode === 500) {
    responsePayload.error.stack = err.stack;
  }

  return res.status(statusCode).json(responsePayload);
};

module.exports = errorHandler;
