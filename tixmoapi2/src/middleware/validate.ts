import { Request, Response, NextFunction } from 'express';
import { ZodObject, ZodIssue } from 'zod';
import { ApiError } from '../utils/ApiError';

type ParseInput = { body: unknown; query: unknown; params: unknown };
type Validated = { body?: Request['body']; query?: Request['query']; params?: Request['params'] };

export const validate = (schema: ZodObject) => {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parseInput: ParseInput = { body: req.body, query: req.query, params: req.params };

      const result = await schema.safeParseAsync(parseInput);

      if (!result.success) {
        const errors = result.error.issues.map((e: ZodIssue) => ({
          path: e.path.join('.'),
          message: e.message,
        })) as { path: string; message: string }[];
        return next(ApiError.badRequest('Validation failed', errors));
      }

      const validatedObj = result.data as Validated;
      if (validatedObj.body !== undefined) {
        // Zod validated this shape; assert for the runtime-assigned value.
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        req.body = validatedObj.body;
      }
      if (validatedObj.query !== undefined) {
        req.query = validatedObj.query;
      }
      if (validatedObj.params !== undefined) {
        req.params = validatedObj.params;
      }

      return next();
    } catch (err: unknown) {
      return next(err);
    }
  };
};
