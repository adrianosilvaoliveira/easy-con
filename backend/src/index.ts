import './shared/types/express';
import type { Express, NextFunction, Request, Response } from 'express';
import express from 'express';

/**
 * Não importa createApp no topo: na Vercel o bundle avaliaria env/prisma/bcrypt
 * na subida da lambda e virava FUNCTION_INVOCATION_FAILED.
 */
const app = express();
let innerPromise: Promise<Express> | null = null;

function loadInner(): Promise<Express> {
  if (!innerPromise) {
    innerPromise = import('./createApp')
      .then((mod) => mod.createApp())
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        console.error('BOOT_FAILED', err);
        const fail = express();
        fail.use((_req: Request, res: Response) => {
          res.status(500).json({ success: false, error: 'BOOT_FAILED', message });
        });
        return fail;
      });
  }
  return innerPromise;
}

app.use((req: Request, res: Response, next: NextFunction) => {
  void loadInner()
    .then((inner) => {
      inner(req, res, next);
    })
    .catch(next);
});

/** Entrypoint para Vercel (@vercel/backends / Express). */
export default app;
