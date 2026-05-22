import cron from 'node-cron';
import { BatchService } from '../modules/batches/BatchService';
import { AlertService } from '../modules/batches/AlertService';
import { logger } from '../shared/logger';

export function startExpirationCron() {
  cron.schedule('0 6 * * *', async () => {
    try {
      const result = await BatchService.runExpirationJob();
      const purged = await AlertService.purgeOldHistory();
      logger.info('Expiration cron executed', { ...result, purged });
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
