import Joi from 'joi';
import type { ValidationSchema } from '../../middlewares/validate';

const MAX_POINTS_VALUE = 100000000;

const nameField = Joi.string().trim().min(1).max(100).messages({
  'string.empty': 'Customer name is required',
  'string.max': 'Customer name must not exceed 100 characters',
  'any.required': 'Customer name is required',
});

const phoneField = Joi.string().trim().max(50).allow('', null).messages({
  'string.max': 'Phone must not exceed 50 characters',
});

const addressField = Joi.string().trim().max(1000).allow('', null).messages({
  'string.max': 'Address must not exceed 1000 characters',
});

export const listCustomersSchema: ValidationSchema = {
  query: Joi.object({
    page: Joi.number().empty('').integer().min(1).default(1),
    limit: Joi.number().empty('').integer().min(1).max(100).default(20),
    minPoints: Joi.number().empty('').integer().min(0).optional(),
    search: Joi.string().trim().empty('').max(100).optional(),
    sortBy: Joi.string().trim().empty('').valid('id', 'name', 'points', 'createdAt', 'salesCount', 'totalSpent').default('createdAt'),
    sortOrder: Joi.string().trim().empty('').lowercase().valid('asc', 'desc').default('desc'),
  }),
};

export const customerIdParamSchema: ValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      'number.base': 'Customer ID must be a valid number',
      'number.integer': 'Customer ID must be an integer',
      'number.positive': 'Customer ID must be a positive integer',
      'any.required': 'Customer ID is required',
    }),
  }),
};

export const createCustomerSchema: ValidationSchema = {
  body: Joi.object({
    name: nameField.required(),
    phone: phoneField.optional(),
    address: addressField.optional(),
    points: Joi.number().integer().min(0).max(MAX_POINTS_VALUE).default(0).messages({
      'number.base': 'Points must be a valid number',
      'number.integer': 'Points must be an integer',
      'number.min': 'Points cannot be negative',
      'number.max': `Points must not exceed ${MAX_POINTS_VALUE}`,
    }),
  }),
};

export const updateCustomerSchema: ValidationSchema = {
  params: customerIdParamSchema.params,
  body: Joi.object({
    name: nameField.optional().messages({
      'string.empty': 'Customer name cannot be empty',
      'string.max': 'Customer name must not exceed 100 characters',
    }),
    phone: phoneField.optional(),
    address: addressField.optional(),
  })
    .min(1)
    .messages({
      'object.min': 'At least one customer field must be provided',
    }),
};

export const adjustCustomerPointsSchema: ValidationSchema = {
  params: customerIdParamSchema.params,
  body: Joi.object({
    action: Joi.string().trim().lowercase().valid('add', 'deduct', 'set').required().messages({
      'any.only': 'Action must be one of add, deduct, or set',
      'any.required': 'Action is required',
    }),
    points: Joi.number()
      .integer()
      .max(MAX_POINTS_VALUE)
      .when('action', {
        is: 'set',
        then: Joi.number().min(0).messages({
          'number.min': 'Points cannot be negative',
        }),
        otherwise: Joi.number().min(1).messages({
          'number.min': 'Points must be at least 1 for add or deduct actions',
        }),
      })
      .required()
      .messages({
        'number.base': 'Points must be a valid number',
        'number.integer': 'Points must be an integer',
        'number.max': `Points must not exceed ${MAX_POINTS_VALUE}`,
        'any.required': 'Points is required',
      }),
    reason: Joi.string().trim().max(255).allow('', null).optional().messages({
      'string.max': 'Reason must not exceed 255 characters',
    }),
  }),
};

export const customersValidation = {
  listCustomersSchema,
  customerIdParamSchema,
  createCustomerSchema,
  updateCustomerSchema,
  adjustCustomerPointsSchema,
};

export default customersValidation;
