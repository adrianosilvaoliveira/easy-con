import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors/AppError';
import { logger } from '../shared/logger';

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      errors: err.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      code: err.code,
      message: err.message,
    });
    return;
  }

  logger.error('Unhandled error', err);
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Erro interno do servidor',
  });
}
