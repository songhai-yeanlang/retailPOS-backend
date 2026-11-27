import type { NextFunction, Request, Response } from 'express';
import ApiError from '../utils/api-error';

export const notFound = (req: Request, _res: Response, next: NextFunction): void => {
  next(ApiError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
};

export default notFound;
