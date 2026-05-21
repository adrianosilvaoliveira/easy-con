import { Router } from 'express';
import { InventoryController } from '../modules/inventory/InventoryController';
import { authenticate, authorize } from '../middlewares/auth';
import { auditAction } from '../middlewares/audit';

const inventoryRoutes = Router();

inventoryRoutes.use(authenticate);

inventoryRoutes.get('/', authorize('inventory:READ'), InventoryController.list);
inventoryRoutes.get('/:id', authorize('inventory:READ'), InventoryController.findById);
inventoryRoutes.post(
  '/',
  authorize('inventory:CREATE'),
  auditAction('CREATE_INVENTORY', 'inventory'),
  InventoryController.create
);
inventoryRoutes.put(
  '/:id/items',
  authorize('inventory:UPDATE'),
  InventoryController.updateItem
);
inventoryRoutes.post(
  '/:id/complete',
  authorize('inventory:UPDATE'),
  auditAction('COMPLETE_INVENTORY', 'inventory'),
  InventoryController.complete
);

export { inventoryRoutes };
