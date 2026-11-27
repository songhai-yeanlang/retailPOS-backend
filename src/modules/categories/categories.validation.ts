import Joi from 'joi';
import type { ValidationSchema } from '../../middlewares/validate';

const nameField = Joi.string().trim().min(1).max(100).messages({
  'string.empty': 'Category name is required',
  'string.max': 'Category name must not exceed 100 characters',
  'any.required': 'Category name is required',
});

const descriptionField = Joi.string().trim().max(1000).allow('', null).messages({
  'string.max': 'Description must not exceed 1000 characters',
});

export const listCategoriesSchema: ValidationSchema = {
  query: Joi.object({
    page: Joi.number().empty('').integer().min(1).default(1),
    limit: Joi.number().empty('').integer().min(1).max(100).default(20),
    search: Joi.string().trim().empty('').max(100).optional(),
    sortBy: Joi.string().trim().empty('').valid('id', 'name', 'createdAt', 'productCount').default('createdAt'),
    sortOrder: Joi.string().trim().empty('').lowercase().valid('asc', 'desc').default('desc'),
  }),
};

export const categoryIdParamSchema: ValidationSchema = {
  params: Joi.object({
    id: Joi.number().integer().positive().required().messages({
      'number.base': 'Category ID must be a valid number',
      'number.integer': 'Category ID must be an integer',
      'number.positive': 'Category ID must be a positive integer',
      'any.required': 'Category ID is required',
    }),
  }),
};

export const createCategorySchema: ValidationSchema = {
  body: Joi.object({
    name: nameField.required(),
    description: descriptionField.optional(),
  }),
};

export const updateCategorySchema: ValidationSchema = {
  params: categoryIdParamSchema.params,
  body: Joi.object({
    name: nameField.optional().messages({
      'string.empty': 'Category name cannot be empty',
      'string.max': 'Category name must not exceed 100 characters',
    }),
    description: descriptionField.optional(),
  })
    .min(1)
    .messages({
      'object.min': 'At least one category field must be provided',
    }),
};

export const categoriesValidation = {
  listCategoriesSchema,
  categoryIdParamSchema,
  createCategorySchema,
  updateCategorySchema,
};

export default categoriesValidation;
