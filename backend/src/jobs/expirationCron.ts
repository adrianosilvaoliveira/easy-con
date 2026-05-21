import cron from 'node-cron';
import { BatchService } from '../modules/batches/BatchService';
import { logger } from '../shared/logger';

export function startExpirationCron() {
  cron.schedule('0 6 * * *', async () => {
    try {
      const result = await BatchService.runExpirationJob();
      logger.info('Expiration cron executed', result);
    } catch (error) {
      logger.error('Expiration cron failed', error);
    }
  });

  cron.schedule('0 */4 * * *', async () => {
    try {
      await BatchService.runExpirationJob();
    } catch (error) {
      logger.error('Expiration sync failed', error);
    }
  });

  logger.info('Expiration cron jobs scheduled');
}
