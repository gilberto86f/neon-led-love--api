import { Request, Response, NextFunction } from 'express';
import { HttpError } from '../utils/HttpError';
import { fail } from '../utils/apiResponse';

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json(fail('Route not found', 404));
};

export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof HttpError) {
    res.status(err.status).json(fail(err.message, err.status));
    return;
  }
  console.error('[unhandled]', err);
  const message = err instanceof Error ? err.message : 'Internal server error';
  res.status(500).json(fail(message, 500));
};
