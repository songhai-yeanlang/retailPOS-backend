import Joi from 'joi';
import type { ValidationSchema } from '../../middlewares/validate';

const MAX_PRICE = 9999999999.99;
const MAX_QTY = 100000000;

const nameField = Joi.string().trim().min(1).max(150).messages({
  'string.empty': 'Product name is required',
  'string.max': 'Product name must not exceed 150 characters',
  'any.required': 'Product name is required',
});

const barcodeField = Joi.string().trim().max(100).allow('', null).messages({
  'string.max': 'Barcode must not exceed 100 characters',
});

const categoryIdField = Joi.number().integer().positive().allow('', null).messages({
  'number.base': 'Category ID must be a valid number',
  'number.integer': 'Category ID must be an integer',
  'number.positive': 'Category ID must be a positive integer',
});

const priceField = (label: string) =>
  Joi.number().min(0).max(MAX_PRICE).precision(2).messages({
    'number.base': `${label} must be a valid number`,
    'number.min': `${label} cannot be negative`,
    'number.max': `${label} must not exceed ${MAX_PRICE}`,
  });

const nonNegativeIntField = (label: string) =>
  Joi.number().integer().min(0).max(MAX_QTY).messages({
    'number.base': `${label} must be a valid number`,
    'number.integer': `${label} must be an integer`,
    'number.min': `${label} cannot be negative`,
    'number.max': `${label} must not exceed ${MAX_QTY}`,
  });

const unitField = Joi.string().trim().min(1).max(50).messages({
  'string.empty': 'Unit cannot be empty',
  'string.max': 'Unit must not exceed 50 characters',
});

export const listProductsSchema: ValidationSchema = {
  query: Joi.object({
    page: Joi.number().empty('').integer().min(1).default(1),
    limit: Joi.number().empty('').integer().min(1).max(100).default(20),
    categoryId: Joi.number().empty('').integer().positive().optional(),
    isActive: Joi.boolean().empty('').optional(),
    lowStock: Joi.boolean().empty('').optional(),
    outOfStock: Joi.boolean().empty('').optional(),
    search: Joi.string().trim().empty('').max(100).optional(),
    sortBy: Joi.string().trim().empty('').valid('id', 'name', 'sellPrice', 'costPrice', 'stockQty', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().trim().empty('').lowercase().valid('asc', 'desc').default('desc'),
  }),
};

export const listLowStockProductsSchema: ValidationSchema = {
  query: Joi.object({
    page: Joi.number().empty('').integer().min(1).default(1),
    limit: Joi.number().empty('').integer().min(1).max(100).default(20),
    categoryId: Joi.number().empty('').integer().positive().optional(),
    search: Joi.string().trim().empty('').max(100).optional(),
  }),
};

export const productIdParamSchema: ValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      'number.base': 'Product ID must be a valid number',
      'number.integer': 'Product ID must be an integer',
      'number.positive': 'Product ID must be a positive integer',
      'any.required': 'Product ID is required',
    }),
  }),
};

export const productBarcodeParamSchema: ValidationSchema = {
  params: Joi.object({
    barcode: Joi.string().trim().min(1).max(100).required().messages({
      'string.empty': 'Barcode is required',
      'string.max': 'Barcode must not exceed 100 characters',
      'any.required': 'Barcode is required',
    }),
  }),
};

export const createProductSchema: ValidationSchema = {
  body: Joi.object({
    categoryId: categoryIdField.optional(),
    barcode: barcodeField.optional(),
    name: nameField.required(),
    costPrice: priceField('Cost price').empty('').default(0),
    sellPrice: priceField('Sell price').empty('').default(0),
    stockQty: nonNegativeIntField('Stock quantity').empty('').default(0),
    alertQty: nonNegativeIntField('Alert quantity').empty('').default(5),
    unit: unitField.empty('').default('pcs'),
    isActive: Joi.boolean().empty('').default(true),
  }),
};

export const updateProductSchema: ValidationSchema = {
  params: productIdParamSchema.params,
  body: Joi.object({
    categoryId: categoryIdField.optional(),
    barcode: barcodeField.optional(),
    name: nameField.optional().messages({
      'string.empty': 'Product name cannot be empty',
      'string.max': 'Product name must not exceed 150 characters',
    }),
    costPrice: priceField('Cost price').empty('').optional(),
    sellPrice: priceField('Sell price').empty('').optional(),
    alertQty: nonNegativeIntField('Alert quantity').empty('').optional(),
    unit: unitField.empty('').optional(),
    isActive: Joi.boolean().empty('').optional(),
    removeImage: Joi.boolean().empty('').optional(),
  }),
};

export const updateProductStatusSchema: ValidationSchema = {
  params: productIdParamSchema.params,
  body: Joi.object({
    isActive: Joi.boolean().required().messages({
      'boolean.base': 'isActive must be a boolean',
      'any.required': 'isActive is required',
    }),
  }),
};

export const adjustProductStockSchema: ValidationSchema = {
  params: productIdParamSchema.params,
  body: Joi.object({
    action: Joi.string().trim().lowercase().valid('add', 'deduct', 'set').required().messages({
      'any.only': 'Action must be one of add, deduct, or set',
      'any.required': 'Action is required',
    }),
    qty: Joi.number()
      .integer()
      .max(MAX_QTY)
      .when('action', {
        is: 'set',
        then: Joi.number().min(0).messages({
          'number.min': 'Quantity cannot be negative',
        }),
        otherwise: Joi.number().min(1).messages({
          'number.min': 'Quantity must be at least 1 for add or deduct actions',
        }),
      })
      .required()
      .messages({
        'number.base': 'Quantity must be a valid number',
        'number.integer': 'Quantity must be an integer',
        'number.max': `Quantity must not exceed ${MAX_QTY}`,
        'any.required': 'Quantity is required',
      }),
    reason: Joi.string().trim().max(255).allow('', null).optional().messages({
      'string.max': 'Reason must not exceed 255 characters',
    }),
  }),
};

export const productsValidation = {
  listProductsSchema,
  listLowStockProductsSchema,
  productIdParamSchema,
  productBarcodeParamSchema,
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
  adjustProductStockSchema,
};

export default productsValidation;
