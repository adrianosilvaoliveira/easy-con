import type { Request, Response, NextFunction, RequestHandler } from 'express';

type AsyncRoute = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/** Express 4 não trata Promise rejeitada — evita requisição “travada” na Vercel */
export function asyncHandler(fn: AsyncRoute): RequestHandler {
  return (req, res, next) => {
    void fn(req, res, next).catch(next);
  };
}
