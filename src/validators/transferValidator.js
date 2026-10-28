const Joi = require('joi');

const transferFundsSchema = Joi.object({
  from_account_id: Joi.string().trim().required().messages({
    'string.base': 'from_account_id must be a string',
    'string.empty': 'from_account_id cannot be empty',
    'any.required': 'from_account_id is required',
  }),
  to_account_id: Joi.string().trim().required().messages({
    'string.base': 'to_account_id must be a string',
    'string.empty': 'to_account_id cannot be empty',
    'any.required': 'to_account_id is required',
  }),
  amount: Joi.number().positive().precision(2).required().messages({
    'number.base': 'Transfer amount must be a valid number',
    'number.positive': 'Transfer amount must be greater than 0',
    'number.precision': 'Transfer amount cannot have more than 2 decimal places',
    'any.required': 'Transfer amount is required',
  }),
  description: Joi.string().trim().max(500).allow('').optional().messages({
    'string.base': 'description must be a string',
    'string.max': 'description cannot exceed 500 characters',
  }),
  reference_id: Joi.string().trim().min(1).max(150).required().messages({
    'string.base': 'reference_id must be a string',
    'string.empty': 'reference_id is required and cannot be empty',
    'any.required': 'reference_id is required',
  }),
});

module.exports = {
  transferFundsSchema,
};
