import express, { Express, Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createRequire } from 'module';
import { env } from './configs/env';
import { logger } from './shared/logger';

const frontendRoot = path.resolve(__dirname, '../../frontend');
const publicDir = path.resolve(__dirname, '../public');

/** `npm start` usa dist/ — sempre arquivos estáticos; Vite só em `npm run dev` (src/) */
const isCompiledBuild = __dirname.split(path.sep).includes('dist');

function spaFallback(req: Request, res: Response, next: NextFunction): void {
  if (req.method !== 'GET' || req.path.startsWith('/api')) {
    next();
    return;
  }
  res.sendFile(path.join(publicDir, 'index.html'), (err) => {
    if (err) next(err);
  });
}

async function attachViteDev(app: Express): Promise<boolean> {
  const viteModulePath = path.join(frontendRoot, 'node_modules', 'vite');
  if (!fs.existsSync(viteModulePath)) {
    return false;
  }

  try {
    const require = createRequire(__filename);
    const { createServer } = require(viteModulePath) as typeof import('vite');
    const vite = await createServer({
      root: frontendRoot,
      configFile: path.join(frontendRoot, 'vite.config.ts'),
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    logger.info('Frontend (Vite HMR) no mesmo servidor — http://localhost:' + env.PORT);
    return true;
  } catch (err) {
    logger.warn('Vite dev indisponível; use build do frontend ou npm install em frontend/', err);
    return false;
  }
}

export async function attachFrontend(app: Express): Promise<void> {
  if (env.NODE_ENV === 'development' && !isCompiledBuild) {
    const viteOk = await attachViteDev(app);
    if (viteOk) return;
  }

  const indexPath = path.join(publicDir, 'index.html');
  if (!fs.existsSync(indexPath)) {
    if (env.NODE_ENV === 'production') {
      logger.warn(
        'Build do frontend ausente (backend/public). Execute: npm run build --prefix frontend'
      );
    }
    return;
  }

  app.use(
    express.static(publicDir, {
      index: false,
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        }
      },
    })
  );

  app.get('*', (req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    spaFallback(req, res, next);
  });
  logger.info(`Frontend estático em ${publicDir}`);
}
