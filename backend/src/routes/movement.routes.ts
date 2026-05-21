import { Router } from 'express';
import { MovementController } from '../modules/movements/MovementController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  entrySchema,
  exitSchema,
  transferSchema,
  approveTransferSchema,
} from '../modules/movements/movements.dto';
import { auditAction } from '../middlewares/audit';

const movementRoutes = Router();

movementRoutes.use(authenticate);

movementRoutes.get('/', authorize('movements:READ'), MovementController.list);
movementRoutes.get('/:id', authorize('movements:READ'), MovementController.findById);
movementRoutes.post(
  '/entries',
  authorize('movements:CREATE'),
  validate(entrySchema),
  auditAction('CREATE_ENTRY', 'movements'),
  MovementController.createEntry
);
movementRoutes.post(
  '/exits',
  authorize('movements:CREATE'),
  validate(exitSchema),
  auditAction('CREATE_EXIT', 'movements'),
  MovementController.createExit
);
movementRoutes.post(
  '/transfers',
  authorize('movements:CREATE'),
  validate(transferSchema),
  auditAction('CREATE_TRANSFER', 'movements'),
  MovementController.createTransfer
);
movementRoutes.patch(
  '/transfers/:id/approve',
  authorize('movements:APPROVE'),
  validate(approveTransferSchema),
  auditAction('APPROVE_TRANSFER', 'movements'),
  MovementController.approveTransfer
);

export { movementRoutes };
