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

const dateQueryField = (fieldName: 'startDate' | 'endDate') =>
  Joi.string()
    .trim()
    .empty('')
    .custom(validateIsoDateOrDateTime, 'ISO date/datetime validation')
    .optional()
    .messages({
      'any.invalid': `${fieldName} must be a valid date (YYYY-MM-DD) or ISO 8601 datetime`,
    });

export const listAuditLogsSchema: ValidationSchema = {
  query: Joi.object({
    page: Joi.number().empty('').integer().min(1).default(1),
    limit: Joi.number().empty('').integer().min(1).max(100).default(20),
    userId: Joi.number().empty('').integer().positive().optional(),
    action: Joi.string().trim().empty('').max(50).optional(),
    tableName: Joi.string().trim().empty('').max(50).optional(),
    recordId: Joi.number().empty('').integer().positive().optional(),
    startDate: dateQueryField('startDate'),
    endDate: dateQueryField('endDate'),
    search: Joi.string().trim().empty('').max(100).optional(),
    sortOrder: Joi.string().trim().empty('').lowercase().valid('asc', 'desc').default('desc'),
  }),
};

export const auditLogIdParamSchema: ValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      'number.base': 'Audit log ID must be a valid number',
      'number.integer': 'Audit log ID must be an integer',
      'number.positive': 'Audit log ID must be a positive integer',
      'any.required': 'Audit log ID is required',
    }),
  }),
};

export const auditLogsValidation = {
  listAuditLogsSchema,
  auditLogIdParamSchema,
};

export default auditLogsValidation;
