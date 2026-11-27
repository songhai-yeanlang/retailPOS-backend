import Joi from 'joi';
import type { ValidationSchema } from '../../middlewares/validate';

const MAX_EXCHANGE_RATE = 9999999999.99;

const exchangeRateField = Joi.number()
  .greater(0)
  .max(MAX_EXCHANGE_RATE)
  .precision(2)
  .messages({
    'number.base': 'Exchange rate must be a valid number',
    'number.greater': 'Exchange rate must be greater than 0',
    'number.max': `Exchange rate must not exceed ${MAX_EXCHANGE_RATE}`,
    'any.required': 'Exchange rate is required',
  });

export const updateSettingsSchema: ValidationSchema = {
  body: Joi.object({
    shopName: Joi.string().trim().min(1).max(150).optional().messages({
      'string.empty': 'Shop name cannot be empty',
      'string.max': 'Shop name must not exceed 150 characters',
    }),
    phone: Joi.string().trim().max(50).allow('', null).optional().messages({
      'string.max': 'Phone must not exceed 50 characters',
    }),
    address: Joi.string().trim().max(1000).allow('', null).optional().messages({
      'string.max': 'Address must not exceed 1000 characters',
    }),
    exchangeRate: exchangeRateField.optional(),
    receiptFooter: Joi.string().trim().max(255).allow('', null).optional().messages({
      'string.max': 'Receipt footer must not exceed 255 characters',
    }),
  })
    .min(1)
    .messages({
      'object.min': 'At least one settings field must be provided',
    }),
};

export const updateExchangeRateSchema: ValidationSchema = {
  body: Joi.object({
    exchangeRate: exchangeRateField.required(),
  }),
};

export const settingsValidation = {
  updateSettingsSchema,
  updateExchangeRateSchema,
};

export default settingsValidation;
