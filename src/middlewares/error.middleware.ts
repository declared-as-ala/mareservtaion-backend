import { Request, Response, NextFunction } from 'express';
import { logger } from '../config/logger';

const isProd = process.env.NODE_ENV === 'production';

export interface HttpError extends Error {
  statusCode?: number;
  code?: string;
}

export function errorMiddleware(
  err: HttpError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode ?? 500;
  const message = err.message || 'Internal server error';
  logger.error(message, err, { statusCode, path: _req.path });
  res.status(statusCode).json({
    success: false,
    message: isProd && statusCode === 500 ? 'Internal server error' : message,
    data: null,
    meta: null,
    errors: isProd ? null : (err as Error).stack,
  });
}
