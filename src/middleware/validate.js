const ApiError = require('../utils/apiError');
const { ERROR_CODES } = require('../constants/errorCodes');

/**
 * Higher-order middleware function to validate incoming request data using Joi schema
 * @param {Object} schema - Joi schema object
 * @param {'body'|'query'|'params'} source - Property on req to validate ('body', 'query', or 'params')
 */
const validate = (schema, source = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source], {
      abortEarly: false,
      stripUnknown: false,
    });

    if (error) {
      const details = error.details.map((detail) => ({
        field: detail.path.join('.'),
        message: detail.message.replace(/['"]/g, ''),
      }));

      const errorMessage = details.map((d) => d.message).join('; ');
      return next(ApiError.badRequest(errorMessage, ERROR_CODES.VALIDATION_ERROR, details));
    }

    // Replace req[source] with sanitized/validated values
    req[source] = value;
    return next();
  };
};

module.exports = validate;
