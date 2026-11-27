import Joi from 'joi';
import type { ValidationSchema } from '../../middlewares/validate';

const passwordField = Joi.string().min(6).max(100).required().messages({
  'string.empty': 'Password is required',
  'string.min': 'Password must be at least 6 characters long',
  'string.max': 'Password must not exceed 100 characters',
  'any.required': 'Password is required',
});

export const loginSchema: ValidationSchema = {
  body: Joi.object({
    username: Joi.string().trim().min(3).max(100).required().messages({
      'string.empty': 'Username or email is required',
      'string.min': 'Username or email must be at least 3 characters long',
      'any.required': 'Username or email is required',
    }),
    password: Joi.string().min(1).max(100).required().messages({
      'string.empty': 'Password is required',
      'any.required': 'Password is required',
    }),
  }),
};

export const refreshTokenSchema: ValidationSchema = {
  body: Joi.object({
    refreshToken: Joi.string().trim().min(10).required().messages({
      'string.empty': 'Refresh token is required',
      'any.required': 'Refresh token is required',
    }),
  }),
};

export const logoutSchema: ValidationSchema = {
  body: Joi.object({
    refreshToken: Joi.string().trim().min(10).optional(),
    allDevices: Joi.boolean().optional().default(false),
  }),
};

export const changePasswordSchema: ValidationSchema = {
  body: Joi.object({
    currentPassword: Joi.string().min(1).max(100).required().messages({
      'string.empty': 'Current password is required',
      'any.required': 'Current password is required',
    }),
    newPassword: passwordField.messages({
      'string.empty': 'New password is required',
      'string.min': 'New password must be at least 6 characters long',
      'string.max': 'New password must not exceed 100 characters',
      'any.required': 'New password is required',
    }),
  }),
};

export const forgotPasswordSchema: ValidationSchema = {
  body: Joi.object({
    email: Joi.string().trim().lowercase().email().max(100).required().messages({
      'string.empty': 'Email is required',
      'string.email': 'Email must be a valid email address',
      'any.required': 'Email is required',
    }),
  }),
};

export const resetPasswordSchema: ValidationSchema = {
  body: Joi.object({
    token: Joi.string().trim().min(10).max(255).required().messages({
      'string.empty': 'Reset token is required',
      'any.required': 'Reset token is required',
    }),
    newPassword: passwordField.messages({
      'string.empty': 'New password is required',
      'string.min': 'New password must be at least 6 characters long',
      'string.max': 'New password must not exceed 100 characters',
      'any.required': 'New password is required',
    }),
  }),
};

export const authValidation = {
  loginSchema,
  refreshTokenSchema,
  logoutSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
};

export default authValidation;
