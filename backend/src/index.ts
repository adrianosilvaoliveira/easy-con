import type { Express, Request, Response } from 'express';
import express from 'express';

/** Fallback se o boot falhar: a lambda responde JSON em vez de FUNCTION_INVOCATION_FAILED. */
function bootErrorApp(err: unknown): Express {
  const app = express();
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  console.error('BOOT_FAILED', stack || message);
  app.use((_req: Request, res: Response) => {
    res.status(500).json({
      success: false,
      error: 'BOOT_FAILED',
      message,
    });
  });
  return app;
}

function loadApp(): Express {
  try {
    // require dentro do try para capturar falha de env/prisma/native no import
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createApp } = require('./createApp') as { createApp: () => Express };
    return createApp();
  } catch (err) {
    return bootErrorApp(err);
  }
}

/** Entrypoint para Vercel (@vercel/backends / Express). */
export default loadApp();
