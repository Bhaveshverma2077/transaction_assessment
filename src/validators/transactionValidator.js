const Joi = require('joi');
const { ALLOWED_TRANSACTION_TYPES } = require('../constants/transactionTypes');

const addTransactionSchema = Joi.object({
  account_id: Joi.string().trim().optional().messages({
    'string.base': 'account_id must be a string',
    'string.empty': 'account_id cannot be empty',
  }),
  type: Joi.string()
    .trim()
    .lowercase()
    .valid(...ALLOWED_TRANSACTION_TYPES)
    .required()
    .messages({
      'any.only': 'Transaction type must be either credit or debit',
      'any.required': 'Transaction type is required',
      'string.empty': 'Transaction type cannot be empty',
    }),
  amount: Joi.number().positive().precision(2).required().messages({
    'number.base': 'Transaction amount must be a valid number',
    'number.positive': 'Transaction amount must be greater than 0',
    'number.precision': 'Transaction amount cannot have more than 2 decimal places',
    'any.required': 'Transaction amount is required',
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
  balance: Joi.forbidden().messages({
    'any.unknown': 'balance cannot be set directly; it is calculated from transactions',
  }),
  id: Joi.forbidden().messages({
    'any.unknown': 'id cannot be specified; it is system-generated',
  }),
  created_at: Joi.forbidden().messages({
    'any.unknown': 'created_at is system-generated and cannot be set',
  }),
});

const getTransactionHistoryQuerySchema = Joi.object({
  type: Joi.string()
    .trim()
    .lowercase()
    .valid(...ALLOWED_TRANSACTION_TYPES)
    .optional()
    .messages({
      'any.only': 'Filter type must be either credit or debit',
    }),
  page: Joi.number().integer().min(1).default(1).messages({
    'number.base': 'Page must be a valid number',
    'number.integer': 'Page must be an integer',
    'number.min': 'Page must be greater than or equal to 1',
  }),
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.base': 'Limit must be a valid number',
    'number.integer': 'Limit must be an integer',
    'number.min': 'Limit must be greater than or equal to 1',
    'number.max': 'Limit cannot exceed 100',
  }),
});

module.exports = {
  addTransactionSchema,
  getTransactionHistoryQuerySchema,
};
