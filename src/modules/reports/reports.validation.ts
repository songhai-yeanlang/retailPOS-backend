import Joi from 'joi';
import type { ValidationSchema } from '../../middlewares/validate';

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

export const dateRangeReportSchema: ValidationSchema = {
  query: Joi.object({
    startDate: dateField('startDate'),
    endDate: dateField('endDate'),
  }),
};

export const salesSummaryReportSchema: ValidationSchema = {
  query: Joi.object({
    startDate: dateField('startDate'),
    endDate: dateField('endDate'),
    groupBy: Joi.string().trim().empty('').lowercase().valid('day', 'month', 'year').default('day'),
    userId: Joi.number().empty('').integer().positive().optional(),
    customerId: Joi.number().empty('').integer().positive().optional(),
    paymentMethodId: Joi.number().empty('').integer().positive().optional(),
  }),
};

export const topProductsReportSchema: ValidationSchema = {
  query: Joi.object({
    startDate: dateField('startDate'),
    endDate: dateField('endDate'),
    categoryId: Joi.number().empty('').integer().positive().optional(),
    limit: Joi.number().empty('').integer().min(1).max(100).default(10),
    sortBy: Joi.string().trim().empty('').valid('qtySold', 'revenue', 'grossProfit').default('qtySold'),
    sortOrder: Joi.string().trim().empty('').lowercase().valid('asc', 'desc').default('desc'),
  }),
};

export const inventoryReportSchema: ValidationSchema = {
  query: Joi.object({
    categoryId: Joi.number().empty('').integer().positive().optional(),
    isActive: Joi.boolean().empty('').truthy('1', 'true').falsy('0', 'false').optional(),
    lowStockLimit: Joi.number().empty('').integer().min(1).max(100).default(20),
  }),
};

export const purchasesSummaryReportSchema: ValidationSchema = {
  query: Joi.object({
    startDate: dateField('startDate'),
    endDate: dateField('endDate'),
    supplierId: Joi.number().empty('').integer().positive().optional(),
    groupBy: Joi.string().trim().empty('').lowercase().valid('day', 'month', 'year').default('day'),
  }),
};

export const reportsValidation = {
  dateRangeReportSchema,
  salesSummaryReportSchema,
  topProductsReportSchema,
  inventoryReportSchema,
  purchasesSummaryReportSchema,
};

export default reportsValidation;
