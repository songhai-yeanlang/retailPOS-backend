import Joi from 'joi';
import type { ValidationSchema } from '../../middlewares/validate';

const USER_ROLES = ['owner', 'manager', 'cashier'] as const;
const USERNAME_REGEX = /^[a-zA-Z0-9._-]+$/;

const passwordField = Joi.string().min(6).max(100).messages({
  'string.empty': 'Password is required',
  'string.min': 'Password must be at least 6 characters long',
  'string.max': 'Password must not exceed 100 characters',
  'any.required': 'Password is required',
});

const usernameField = Joi.string().trim().min(3).max(50).pattern(USERNAME_REGEX).messages({
  'string.empty': 'Username is required',
  'string.min': 'Username must be at least 3 characters long',
  'string.max': 'Username must not exceed 50 characters',
  'string.pattern.base': 'Username may only contain letters, numbers, dots, underscores, and hyphens',
  'any.required': 'Username is required',
});

const emailField = Joi.string().trim().lowercase().email().max(100).allow('', null).messages({
  'string.email': 'Email must be a valid email address',
  'string.max': 'Email must not exceed 100 characters',
});

const roleField = Joi.string().trim().lowercase().valid(...USER_ROLES).messages({
  'any.only': 'Role must be one of owner, manager, or cashier',
});

export const listUsersSchema: ValidationSchema = {
  query: Joi.object({
    page: Joi.number().empty('').integer().min(1).default(1),
    limit: Joi.number().empty('').integer().min(1).max(100).default(20),
    role: roleField.empty('').optional(),
    isActive: Joi.boolean().empty('').optional(),
    search: Joi.string().trim().empty('').max(100).optional(),
    sortBy: Joi.string().trim().empty('').valid('id', 'fullName', 'username', 'role', 'createdAt').default('createdAt'),
    sortOrder: Joi.string().trim().empty('').lowercase().valid('asc', 'desc').default('desc'),
  }),
};

export const userIdParamSchema: ValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      'number.base': 'User ID must be a valid number',
      'number.integer': 'User ID must be an integer',
      'number.positive': 'User ID must be a positive integer',
      'any.required': 'User ID is required',
    }),
  }),
};

export const createUserSchema: ValidationSchema = {
  body: Joi.object({
    fullName: Joi.string().trim().min(1).max(100).required().messages({
      'string.empty': 'Full name is required',
      'string.max': 'Full name must not exceed 100 characters',
      'any.required': 'Full name is required',
    }),
    username: usernameField.required(),
    email: emailField.optional(),
    password: passwordField.required(),
    role: roleField.default('cashier'),
    isActive: Joi.boolean().default(true),
  }),
};

export const updateUserSchema: ValidationSchema = {
  params: userIdParamSchema.params,
  body: Joi.object({
    fullName: Joi.string().trim().min(1).max(100).optional().messages({
      'string.empty': 'Full name cannot be empty',
      'string.max': 'Full name must not exceed 100 characters',
    }),
    username: usernameField.optional(),
    email: emailField.optional(),
    role: roleField.optional(),
    isActive: Joi.boolean().optional(),
  })
    .min(1)
    .messages({
      'object.min': 'At least one user field must be provided',
    }),
};

export const updateUserStatusSchema: ValidationSchema = {
  params: userIdParamSchema.params,
  body: Joi.object({
    isActive: Joi.boolean().required().messages({
      'boolean.base': 'isActive must be a boolean',
      'any.required': 'isActive is required',
    }),
  }),
};

export const adminResetPasswordSchema: ValidationSchema = {
  params: userIdParamSchema.params,
  body: Joi.object({
    newPassword: passwordField.required().messages({
      'string.empty': 'New password is required',
      'string.min': 'New password must be at least 6 characters long',
      'string.max': 'New password must not exceed 100 characters',
      'any.required': 'New password is required',
    }),
  }),
};

export const usersValidation = {
  listUsersSchema,
  userIdParamSchema,
  createUserSchema,
  updateUserSchema,
  updateUserStatusSchema,
  adminResetPasswordSchema,
};

export default usersValidation;
