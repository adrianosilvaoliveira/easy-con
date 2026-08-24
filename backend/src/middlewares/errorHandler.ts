import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../shared/errors/AppError';
import { logger } from '../shared/logger';
import {
  getPrismaErrorCode,
  isPrismaConnectionError,
  isPrismaSchemaError,
  isTransientDbError,
} from '../shared/utils/prismaErrors';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (res.headersSent) {
    logger.error('Unhandled error after headers sent', {
      message: err.message,
      stack: err.stack,
      requestId: req.requestId,
    });
    return;
  }

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

  const prismaCode = getPrismaErrorCode(err);
  if (prismaCode === 'P2002') {
    res.status(422).json({
      success: false,
      code: 'VALIDATION_ERROR',
      message: 'Registro duplicado. Verifique códigos ou identificadores únicos.',
    });
    return;
  }
  if (isPrismaSchemaError(err)) {
    logger.error('Schema mismatch', { message: err.message, prismaCode, requestId: req.requestId });
    res.status(503).json({
      success: false,
      code: 'DATABASE_SCHEMA_MISMATCH',
      message: 'Banco desatualizado em relação ao sistema. Contate o administrador.',
      requestId: req.requestId,
    });
    return;
  }
  if (isPrismaConnectionError(err) || isTransientDbError(err)) {
    const message =
      prismaCode === 'P2021'
        ? 'Banco de dados sem tabelas. Rode: cd backend && .\\scripts\\seed-vercel.ps1'
        : 'Banco de dados indisponível. Tente novamente em instantes.';
    logger.warn('Database unavailable', { message: err.message, prismaCode, requestId: req.requestId });
    res.status(503).json({
      success: false,
      code: 'DATABASE_NOT_READY',
      message,
      requestId: req.requestId,
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

  logger.error('Unhandled error', {
    message: err.message,
    stack: err.stack,
    prismaCode,
    requestId: req.requestId,
  });
  res.status(500).json({
    success: false,
    code: 'INTERNAL_ERROR',
    message: 'Erro interno do servidor',
    requestId: req.requestId,
  });
}
