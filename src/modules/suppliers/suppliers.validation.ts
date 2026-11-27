import Joi from 'joi';
import type { ValidationSchema } from '../../middlewares/validate';

const nameField = Joi.string().trim().min(1).max(150).messages({
  'string.empty': 'Supplier name is required',
  'string.max': 'Supplier name must not exceed 150 characters',
  'any.required': 'Supplier name is required',
});

const phoneField = Joi.string().trim().max(50).allow('', null).messages({
  'string.max': 'Phone must not exceed 50 characters',
});

const addressField = Joi.string().trim().max(1000).allow('', null).messages({
  'string.max': 'Address must not exceed 1000 characters',
});

export const listSuppliersSchema: ValidationSchema = {
  query: Joi.object({
    page: Joi.number().empty('').integer().min(1).default(1),
    limit: Joi.number().empty('').integer().min(1).max(100).default(20),
    search: Joi.string().trim().empty('').max(100).optional(),
    sortBy: Joi.string().trim().empty('').valid('id', 'name', 'createdAt', 'purchaseCount').default('createdAt'),
    sortOrder: Joi.string().trim().empty('').lowercase().valid('asc', 'desc').default('desc'),
  }),
};

export const supplierIdParamSchema: ValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      'number.base': 'Supplier ID must be a valid number',
      'number.integer': 'Supplier ID must be an integer',
      'number.positive': 'Supplier ID must be a positive integer',
      'any.required': 'Supplier ID is required',
    }),
  }),
};

export const createSupplierSchema: ValidationSchema = {
  body: Joi.object({
    name: nameField.required(),
    phone: phoneField.optional(),
    address: addressField.optional(),
  }),
};

export const updateSupplierSchema: ValidationSchema = {
  params: supplierIdParamSchema.params,
  body: Joi.object({
    name: nameField.optional().messages({
      'string.empty': 'Supplier name cannot be empty',
      'string.max': 'Supplier name must not exceed 150 characters',
    }),
    phone: phoneField.optional(),
    address: addressField.optional(),
  })
    .min(1)
    .messages({
      'object.min': 'At least one supplier field must be provided',
    }),
};

export const suppliersValidation = {
  listSuppliersSchema,
  supplierIdParamSchema,
  createSupplierSchema,
  updateSupplierSchema,
};

export default suppliersValidation;
