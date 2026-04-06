import { Response } from 'express';

export interface ApiSuccessOptions<T = unknown> {
  data?: T;
  message?: string;
  meta?: Record<string, unknown>;
  statusCode?: number;
}

export interface ApiErrorOptions {
  message?: string;
  errors?: unknown;
  statusCode?: number;
}

export function sendSuccess<T>(res: Response, options: ApiSuccessOptions<T> = {}): void {
  const { data, message = 'OK', meta, statusCode = 200 } = options;
  res.status(statusCode).json({
    success: true,
    message,
    data: data ?? null,
    meta: meta ?? null,
    errors: null,
  });
}

export function sendError(res: Response, options: ApiErrorOptions = {}): void {
  const { message = 'Internal server error', errors = null, statusCode = 500 } = options;
  res.status(statusCode).json({
    success: false,
    message,
    data: null,
    meta: null,
    errors,
  });
}
