import { createApp } from './createApp';
import { attachFrontend } from './setupFrontend';
import { env } from './configs/env';
import { logger } from './shared/logger';
import { startExpirationCron } from './jobs/expirationCron';
import { BatchService } from './modules/batches/BatchService';

void (async () => {
  const app = createApp();
  await attachFrontend(app);
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
})();
