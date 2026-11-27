import Joi from 'joi';
import type { ValidationSchema } from '../../middlewares/validate';

const PAYMENT_TYPES = ['cash', 'qr', 'card', 'other'] as const;

const nameField = Joi.string().trim().min(1).max(50).messages({
  'string.empty': 'Payment method name is required',
  'string.max': 'Payment method name must not exceed 50 characters',
  'any.required': 'Payment method name is required',
});

const typeField = Joi.string().trim().lowercase().valid(...PAYMENT_TYPES).messages({
  'any.only': 'Payment type must be one of cash, qr, card, or other',
});

const accountNameField = Joi.string().trim().max(100).allow('', null).messages({
  'string.max': 'Account name must not exceed 100 characters',
});

const accountNumberField = Joi.string().trim().max(50).allow('', null).messages({
  'string.max': 'Account number must not exceed 50 characters',
});

export const listPaymentMethodsSchema: ValidationSchema = {
  query: Joi.object({
    page: Joi.number().empty('').integer().min(1).default(1),
    limit: Joi.number().empty('').integer().min(1).max(100).default(20),
    type: typeField.empty('').optional(),
    isActive: Joi.boolean().empty('').optional(),
    search: Joi.string().trim().empty('').max(100).optional(),
    sortBy: Joi.string().trim().empty('').valid('id', 'name', 'type', 'createdAt', 'salesCount').default('createdAt'),
    sortOrder: Joi.string().trim().empty('').lowercase().valid('asc', 'desc').default('desc'),
  }),
};

export const paymentMethodIdParamSchema: ValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      'number.base': 'Payment method ID must be a valid number',
      'number.integer': 'Payment method ID must be an integer',
      'number.positive': 'Payment method ID must be a positive integer',
      'any.required': 'Payment method ID is required',
    }),
  }),
};

export const createPaymentMethodSchema: ValidationSchema = {
  body: Joi.object({
    name: nameField.required(),
    type: typeField.empty('').default('cash'),
    accountName: accountNameField.optional(),
    accountNumber: accountNumberField.optional(),
    isActive: Joi.boolean().empty('').default(true),
  }),
};

export const updatePaymentMethodSchema: ValidationSchema = {
  params: paymentMethodIdParamSchema.params,
  body: Joi.object({
    name: nameField.optional().messages({
      'string.empty': 'Payment method name cannot be empty',
      'string.max': 'Payment method name must not exceed 50 characters',
    }),
    type: typeField.empty('').optional(),
    accountName: accountNameField.optional(),
    accountNumber: accountNumberField.optional(),
    isActive: Joi.boolean().empty('').optional(),
    removeQrImage: Joi.boolean().empty('').optional(),
  }),
};

export const updatePaymentMethodStatusSchema: ValidationSchema = {
  params: paymentMethodIdParamSchema.params,
  body: Joi.object({
    isActive: Joi.boolean().required().messages({
      'boolean.base': 'isActive must be a boolean',
      'any.required': 'isActive is required',
    }),
  }),
};

export const paymentsValidation = {
  listPaymentMethodsSchema,
  paymentMethodIdParamSchema,
  createPaymentMethodSchema,
  updatePaymentMethodSchema,
  updatePaymentMethodStatusSchema,
};

export default paymentsValidation;
