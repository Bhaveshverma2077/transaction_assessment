const ApiError = require('../utils/apiError');
const { ERROR_CODES } = require('../constants/errorCodes');

const notFoundHandler = (req, res, next) => {
  next(
    ApiError.notFound(
      `Cannot ${req.method} ${req.originalUrl} - Route not found`,
      ERROR_CODES.ROUTE_NOT_FOUND
    )
  );
};

module.exports = notFoundHandler;
