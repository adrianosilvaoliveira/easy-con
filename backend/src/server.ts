import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import swaggerUi from 'swagger-ui-express';
import { env } from './configs/env';
import { swaggerSpec } from './configs/swagger';
import { apiRoutes } from './routes';
import { errorHandler } from './middlewares/errorHandler';
import { logger } from './shared/logger';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { startExpirationCron } from './jobs/expirationCron';
import { BatchService } from './modules/batches/BatchService';
import { attachFrontend } from './setupFrontend';

const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const app = express();

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
  })
);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/api', apiRoutes);

void attachFrontend(app).then(() => {
  app.use(errorHandler);

  const PORT = env.PORT;

  app.listen(PORT, async () => {
    logger.info(`🚀 Server running on port ${PORT}`);
    logger.info(`📚 Swagger: ${env.API_URL}/api/docs`);
    if (env.NODE_ENV === 'development') {
      logger.info(`🌐 App: http://localhost:${PORT}`);
    }
    startExpirationCron();
    try {
      await BatchService.runExpirationJob();
    } catch (e) {
      logger.warn('Initial expiration sync skipped', e);
    }
  });
});

export default app;
