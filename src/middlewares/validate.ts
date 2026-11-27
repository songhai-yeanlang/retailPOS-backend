import type { NextFunction, Request, Response } from 'express';
import type { ObjectSchema } from 'joi';
import ApiError from '../utils/api-error';

export interface ValidationSchema {
  params?: ObjectSchema;
  query?: ObjectSchema;
  body?: ObjectSchema;
}

interface ValidationErrorItem {
  location: 'params' | 'query' | 'body';
  field: string;
  message: string;
}

const VALIDATION_OPTIONS = {
  abortEarly: false,
  stripUnknown: true,
  convert: true,
} as const;

export const validate = (schema: ValidationSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const errors: ValidationErrorItem[] = [];

    let validatedParams: Record<string, string> | undefined;
    let validatedQuery: Record<string, unknown> | undefined;
    let validatedBody: unknown;

    if (schema.params) {
      const result = schema.params.validate(req.params ?? {}, VALIDATION_OPTIONS);
      if (result.error) {
        for (const detail of result.error.details) {
          errors.push({
            location: 'params',
            field: detail.path.join('.'),
            message: detail.message.replace(/"/g, ''),
          });
        }
      } else {
        validatedParams = result.value as Record<string, string>;
      }
    }

    if (schema.query) {
      const result = schema.query.validate(req.query ?? {}, VALIDATION_OPTIONS);
      if (result.error) {
        for (const detail of result.error.details) {
          errors.push({
            location: 'query',
            field: detail.path.join('.'),
            message: detail.message.replace(/"/g, ''),
          });
        }
      } else {
        validatedQuery = result.value as Record<string, unknown>;
      }
    }

    if (schema.body) {
      const result = schema.body.validate(req.body ?? {}, VALIDATION_OPTIONS);
      if (result.error) {
        for (const detail of result.error.details) {
          errors.push({
            location: 'body',
            field: detail.path.join('.'),
            message: detail.message.replace(/"/g, ''),
          });
        }
      } else {
        validatedBody = result.value as unknown;
      }
    }

    if (errors.length > 0) {
      next(ApiError.badRequest('Validation failed', errors));
      return;
    }

    if (validatedParams !== undefined) {
      req.params = validatedParams;
    }

    if (validatedQuery !== undefined) {
      // Express 5 exposes req.query as a getter-only prototype property
      Object.defineProperty(req, 'query', {
        value: validatedQuery,
        writable: true,
        enumerable: true,
        configurable: true,
      });
    }

    if (schema.body) {
      req.body = validatedBody;
    }

    next();
  };
};

export default validate;
