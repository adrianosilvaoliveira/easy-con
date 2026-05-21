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

  const prismaCode = (err as { code?: string }).code;
  if (prismaCode === 'P2021' || prismaCode === 'P1001') {
    res.status(503).json({
      success: false,
      code: 'DATABASE_NOT_READY',
      message:
        'Banco de dados sem tabelas. Rode: cd backend && .\\scripts\\seed-vercel.ps1',
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
