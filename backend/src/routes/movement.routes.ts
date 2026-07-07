import { Router } from 'express';
import { MovementController } from '../modules/movements/MovementController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import {
  entrySchema,
  exitSchema,
  transferSchema,
  approveMovementSchema,
} from '../modules/movements/movements.dto';
import { auditAction } from '../middlewares/audit';

const movementRoutes = Router();

movementRoutes.use(authenticate);

movementRoutes.get('/', authorize('movements:READ'), asyncHandler(MovementController.list));
movementRoutes.get('/:id', authorize('movements:READ'), asyncHandler(MovementController.findById));
movementRoutes.post(
  '/entries',
  authorize('movements:CREATE'),
  validate(entrySchema),
  auditAction('CREATE_ENTRY', 'movements'),
  asyncHandler(MovementController.createEntry)
);
movementRoutes.post(
  '/exits',
  authorize('movements:CREATE'),
  validate(exitSchema),
  auditAction('CREATE_EXIT', 'movements'),
  asyncHandler(MovementController.createExit)
);
movementRoutes.post(
  '/transfers',
  authorize('movements:CREATE'),
  validate(transferSchema),
  auditAction('CREATE_TRANSFER', 'movements'),
  asyncHandler(MovementController.createTransfer)
);
movementRoutes.patch(
  '/:id/approve',
  authorize('movements:APPROVE'),
  validate(approveMovementSchema),
  auditAction('APPROVE_MOVEMENT', 'movements'),
  asyncHandler(MovementController.approveMovement)
);
movementRoutes.patch(
  '/transfers/:id/approve',
  authorize('movements:APPROVE'),
  validate(approveMovementSchema),
  auditAction('APPROVE_TRANSFER', 'movements'),
  asyncHandler(MovementController.approveTransfer)
);
movementRoutes.delete(
  '/:id',
  authorize('movements:DELETE'),
  auditAction('DELETE_MOVEMENT', 'movements'),
  asyncHandler(MovementController.delete)
);

export { movementRoutes };
