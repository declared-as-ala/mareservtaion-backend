import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { sendError } from '../utils/apiResponse';

type ValidateSource = 'body' | 'query' | 'params';

/**
 * Validate request body, query, or params against a Zod schema.
 * On failure responds with 400 and flattened error messages.
 */
export function validate(schema: ZodSchema, source: ValidateSource = 'body') {
  return (req: Request, res: Response, next: NextFunction): void => {
    const value = req[source];
    const result = schema.safeParse(value);
    if (result.success) {
      (req as any)[source] = result.data;
      next();
      return;
    }
    const err = result.error as ZodError;
    const errors = err.flatten().fieldErrors;
    sendError(res, {
      message: 'Validation failed',
      errors: Object.keys(errors).length ? errors : err.errors,
      statusCode: 400,
    });
  };
}
