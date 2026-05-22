import { Router } from 'express';
import { BatchController } from '../modules/batches/BatchController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  createBatchSchema,
  updateBatchSchema,
  snoozeAlertSchema,
} from '../modules/batches/batches.dto';
import { auditAction } from '../middlewares/audit';

const batchesRoutes = Router();

batchesRoutes.use(authenticate);

batchesRoutes.get('/dashboard', authorize('batches:READ'), BatchController.dashboard);
batchesRoutes.get('/expiring', authorize('batches:READ'), BatchController.expiring);
batchesRoutes.get('/expired', authorize('batches:READ'), BatchController.expired);
batchesRoutes.get('/alerts/count', authorize('batches:READ'), BatchController.alertCount);
batchesRoutes.get('/alerts', authorize('batches:READ'), BatchController.listAlerts);
batchesRoutes.patch('/alerts/read-all', authorize('batches:UPDATE'), BatchController.markAllAlertsRead);
batchesRoutes.patch('/alerts/:id/read', authorize('batches:UPDATE'), BatchController.markAlertRead);
batchesRoutes.patch(
  '/alerts/:id/snooze',
  authorize('batches:UPDATE'),
  validate(snoozeAlertSchema),
  BatchController.snoozeAlert
);
batchesRoutes.get('/', authorize('batches:READ'), BatchController.list);
batchesRoutes.get('/:id', authorize('batches:READ'), BatchController.findById);
batchesRoutes.post(
  '/',
  authorize('batches:CREATE'),
  validate(createBatchSchema),
  auditAction('CREATE_BATCH', 'batches'),
  BatchController.create
);
batchesRoutes.put(
  '/:id',
  authorize('batches:UPDATE'),
  validate(updateBatchSchema),
  auditAction('UPDATE_BATCH', 'batches'),
  BatchController.update
);
batchesRoutes.delete(
  '/:id',
  authorize('batches:DELETE'),
  auditAction('DELETE_BATCH', 'batches'),
  BatchController.delete
);

export { batchesRoutes };
