import Joi from 'joi';
import type { ValidationSchema } from '../../middlewares/validate';

const MAX_PRICE = 9999999999.99;
const MAX_ITEM_QTY = 1000000;
const DATE_ONLY_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_DATETIME_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,6})?(?:Z|([+-])(\d{2}):(\d{2}))?$/;

const isValidCalendarDate = (year: number, month: number, day: number): boolean => {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }

  const check = new Date(Date.UTC(year, month - 1, day));
  return (
    check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
  );
};

const validateIsoDateOrDateTime: Joi.CustomValidator<string> = (value, helpers) => {
  const dateOnlyMatch = DATE_ONLY_REGEX.exec(value);
  if (dateOnlyMatch) {
    const year = Number(dateOnlyMatch[1]);
    const month = Number(dateOnlyMatch[2]);
    const day = Number(dateOnlyMatch[3]);

    if (!isValidCalendarDate(year, month, day)) {
      return helpers.error('any.invalid');
    }

    return value;
  }

  const dateTimeMatch = ISO_DATETIME_REGEX.exec(value);
  if (!dateTimeMatch) {
    return helpers.error('any.invalid');
  }

  const year = Number(dateTimeMatch[1]);
  const month = Number(dateTimeMatch[2]);
  const day = Number(dateTimeMatch[3]);
  const hour = Number(dateTimeMatch[4]);
  const minute = Number(dateTimeMatch[5]);
  const second = Number(dateTimeMatch[6]);
  const tzHour = dateTimeMatch[8] !== undefined ? Number(dateTimeMatch[8]) : 0;
  const tzMinute = dateTimeMatch[9] !== undefined ? Number(dateTimeMatch[9]) : 0;

  if (
    !isValidCalendarDate(year, month, day) ||
    hour > 23 ||
    minute > 59 ||
    second > 59 ||
    tzHour > 23 ||
    tzMinute > 59 ||
    Number.isNaN(Date.parse(value))
  ) {
    return helpers.error('any.invalid');
  }

  return value;
};

const dateField = (fieldName: string) =>
  Joi.string()
    .trim()
    .empty('')
    .custom(validateIsoDateOrDateTime, 'ISO date/datetime validation')
    .optional()
    .messages({
      'any.invalid': `${fieldName} must be a valid date (YYYY-MM-DD) or ISO 8601 datetime`,
    });

export const listPurchasesSchema: ValidationSchema = {
  query: Joi.object({
    page: Joi.number().empty('').integer().min(1).default(1),
    limit: Joi.number().empty('').integer().min(1).max(100).default(20),
    supplierId: Joi.number().empty('').integer().positive().optional(),
    userId: Joi.number().empty('').integer().positive().optional(),
    status: Joi.string().trim().empty('').lowercase().valid('received', 'pending', 'cancelled').optional(),
    startDate: dateField('startDate'),
    endDate: dateField('endDate'),
    search: Joi.string().trim().empty('').max(100).optional(),
    sortBy: Joi.string().trim().empty('').valid('id', 'purchaseDate', 'totalAmount', 'status').default('purchaseDate'),
    sortOrder: Joi.string().trim().empty('').lowercase().valid('asc', 'desc').default('desc'),
  }),
};

export const purchaseIdParamSchema: ValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      'number.base': 'Purchase ID must be a valid number',
      'number.integer': 'Purchase ID must be an integer',
      'number.positive': 'Purchase ID must be a positive integer',
      'any.required': 'Purchase ID is required',
    }),
  }),
};

export const createPurchaseSchema: ValidationSchema = {
  body: Joi.object({
    referenceNo: Joi.string().trim().max(50).allow('', null).optional().messages({
      'string.max': 'Reference number must not exceed 50 characters',
    }),
    supplierId: Joi.number().integer().positive().allow('', null).optional().messages({
      'number.base': 'Supplier ID must be a valid number',
      'number.integer': 'Supplier ID must be an integer',
      'number.positive': 'Supplier ID must be a positive integer',
    }),
    status: Joi.string().trim().empty('').lowercase().valid('received', 'pending').default('received').messages({
      'any.only': 'Initial purchase status must be received or pending',
    }),
    note: Joi.string().trim().max(1000).allow('', null).optional().messages({
      'string.max': 'Note must not exceed 1000 characters',
    }),
    purchaseDate: dateField('purchaseDate').empty(Joi.valid('', null)),
    items: Joi.array()
      .items(
        Joi.object({
          productId: Joi.number().integer().positive().required().messages({
            'number.base': 'Product ID must be a valid number',
            'number.integer': 'Product ID must be an integer',
            'number.positive': 'Product ID must be a positive integer',
            'any.required': 'Product ID is required',
          }),
          qty: Joi.number().integer().min(1).max(MAX_ITEM_QTY).required().messages({
            'number.base': 'Quantity must be a valid number',
            'number.integer': 'Quantity must be an integer',
            'number.min': 'Quantity must be at least 1',
            'number.max': `Quantity must not exceed ${MAX_ITEM_QTY}`,
            'any.required': 'Quantity is required',
          }),
          costPrice: Joi.number().min(0).max(MAX_PRICE).precision(2).required().messages({
            'number.base': 'Cost price must be a valid number',
            'number.min': 'Cost price cannot be negative',
            'number.max': `Cost price must not exceed ${MAX_PRICE}`,
            'any.required': 'Cost price is required',
          }),
        }),
      )
      .min(1)
      .max(200)
      .required()
      .messages({
        'array.base': 'Items must be an array',
        'array.min': 'At least one purchase item is required',
        'array.max': 'A purchase cannot exceed 200 line items',
        'any.required': 'Purchase items are required',
      }),
  }),
};

export const updatePurchaseStatusSchema: ValidationSchema = {
  params: purchaseIdParamSchema.params,
  body: Joi.object({
    status: Joi.string().trim().lowercase().valid('received', 'cancelled').required().messages({
      'any.only': 'Target status must be received or cancelled',
      'any.required': 'Status is required',
    }),
    reason: Joi.string().trim().max(255).allow('', null).optional().messages({
      'string.max': 'Reason must not exceed 255 characters',
    }),
  }),
};

export const purchasesValidation = {
  listPurchasesSchema,
  purchaseIdParamSchema,
  createPurchaseSchema,
  updatePurchaseStatusSchema,
};

export default purchasesValidation;
