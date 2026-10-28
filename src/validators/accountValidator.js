const Joi = require('joi');

const createAccountSchema = Joi.object({
  name: Joi.string().trim().min(1).max(100).required().messages({
    'string.base': 'Account holder name must be a string',
    'string.empty': 'Account holder name is required and cannot be empty',
    'string.min': 'Account holder name must be at least 1 character long',
    'string.max': 'Account holder name cannot exceed 100 characters',
    'any.required': 'Account holder name is required',
  }),
  balance: Joi.forbidden().messages({
    'any.unknown': 'Client is not allowed to set initial balance. Initial balance is always 0',
  }),
  id: Joi.forbidden().messages({
    'any.unknown': 'Client cannot specify custom account id; id is system-generated',
  }),
  created_at: Joi.forbidden().messages({
    'any.unknown': 'created_at is system-generated and cannot be set by client',
  }),
});

module.exports = {
  createAccountSchema,
};
