import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import multer from 'multer';
import env from '../config/env.config';
import type { ApiResponse } from '../types/api.types';
import ApiError from '../utils/api-error';
import logger from '../utils/logger.util';
import { deleteUploadedFile } from './upload';

interface MySqlErrorLike {
  code: string;
  errno?: number;
  sqlMessage?: string;
}

interface BodyParserSyntaxError extends SyntaxError {
  status?: number;
  body?: unknown;
}

const isMySqlError = (error: unknown): error is MySqlErrorLike => {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  );
};

const isBodyParserSyntaxError = (error: unknown): error is BodyParserSyntaxError => {
  return (
    error instanceof SyntaxError &&
    'status' in error &&
    error.status === 400 &&
    'body' in error
  );
};

const mapKnownError = (error: unknown): ApiError | null => {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return ApiError.badRequest(
        `File size exceeds the ${env.upload.maxFileSizeMb}MB limit`,
      );
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return ApiError.badRequest(`Unexpected upload field: ${error.field ?? 'file'}`);
    }
    return ApiError.badRequest(error.message);
  }

  if (isBodyParserSyntaxError(error)) {
    return ApiError.badRequest('Invalid JSON payload');
  }

  if (error instanceof jwt.TokenExpiredError) {
    return ApiError.unauthorized('Authentication token has expired');
  }

  if (error instanceof jwt.JsonWebTokenError) {
    return ApiError.unauthorized('Invalid authentication token');
  }

  if (isMySqlError(error)) {
    switch (error.code) {
      case 'ER_DUP_ENTRY':
        return ApiError.conflict('Duplicate entry: record already exists');
      case 'ER_NO_REFERENCED_ROW':
      case 'ER_NO_REFERENCED_ROW_2':
        return ApiError.badRequest('Referenced record does not exist');
      case 'ER_ROW_IS_REFERENCED':
      case 'ER_ROW_IS_REFERENCED_2':
        return ApiError.conflict(
          'Cannot modify or delete this record because it is referenced by other data',
        );
      case 'ER_DATA_TOO_LONG':
        return ApiError.badRequest('One or more input values exceed the allowed length');
      case 'ER_TRUNCATED_WRONG_VALUE':
      case 'ER_TRUNCATED_WRONG_VALUE_FOR_FIELD':
        return ApiError.badRequest('Invalid value format provided');
      default:
        return null;
    }
  }

  return null;
};

export const errorHandler = (err: unknown, req: Request, res: Response, _next: NextFunction): void => {
  // Clean up any newly written upload if the request failed downstream
  if (req.file?.path) {
    void deleteUploadedFile(req.file.path);
  }

  const mappedError = mapKnownError(err);
  const statusCode = mappedError ? mappedError.statusCode : 500;
  const message = mappedError ? mappedError.message : 'Internal server error';

  if (statusCode >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${statusCode}`, err);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${statusCode}: ${message}`);
  }

  const responseBody: ApiResponse & { stack?: string } = {
    success: false,
    message,
  };

  if (mappedError?.details !== undefined) {
    responseBody.errors = mappedError.details;
  }

  if (env.isDevelopment && statusCode >= 500 && err instanceof Error && err.stack) {
    responseBody.stack = err.stack;
  }

  res.status(statusCode).json(responseBody);
};

export default errorHandler;
