import type { Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import type { Options, RateLimitRequestHandler } from 'express-rate-limit';

export interface CustomRateLimiterOptions {
  windowMs: number;
  limit: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
}

export const createRateLimiter = (options: CustomRateLimiterOptions): RateLimitRequestHandler => {
  const errorMessage = options.message ?? 'Too many requests, please try again later';

  const config: Partial<Options> = {
    windowMs: options.windowMs,
    limit: options.limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    skipSuccessfulRequests: options.skipSuccessfulRequests ?? false,
    handler: (_req: Request, res: Response, _next, rateLimitOptions): void => {
      res.status(rateLimitOptions.statusCode).json({
        success: false,
        message: errorMessage,
      });
    },
  };

  return rateLimit(config);
};

export const apiRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200,
  message: 'Too many API requests from this IP, please try again after 15 minutes',
});

export const authRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 15,
  message: 'Too many authentication attempts, please try again after 15 minutes',
});

export default apiRateLimiter;
