import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { env } from './configs/env';
import { swaggerSpec } from './configs/swagger';
import { apiRoutes } from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from './shared/logger';
const isVercel = !!process.env.VERCEL;

export function createApp(): Express {
  if (!isVercel) {
    const logsDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
  }

  const app = express();

  if (isVercel) {
    app.set('trust proxy', 1);
  }

  app.use(
    env.NODE_ENV === 'production'
      ? helmet()
      : helmet({ contentSecurityPolicy: false })
  );
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '10mb' }));
  app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

  app.use((req, _res, next) => {
    req.requestId = uuidv4();
    next();
  });

  app.use(
    rateLimit({
      windowMs: env.RATE_LIMIT_WINDOW_MS,
      max: env.RATE_LIMIT_MAX,
      message: { success: false, message: 'Muitas requisições. Tente novamente mais tarde.' },
      validate: isVercel ? { xForwardedForHeader: false } : undefined,
    })
  );

  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.use('/api', apiRoutes);

  app.use(errorHandler);

  return app;
}
