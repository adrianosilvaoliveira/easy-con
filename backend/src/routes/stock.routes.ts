import { Router } from 'express';
import { StockController } from '../modules/stock/StockController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createLocationSchema, updateLocationSchema } from '../modules/stock/stock.dto';
import { auditAction } from '../middlewares/audit';

const stockRoutes = Router();

stockRoutes.use(authenticate);
stockRoutes.get('/alerts', authorize('stock:READ'), StockController.getAlerts);
stockRoutes.get('/locations', authorize('stock:READ'), StockController.listLocations);
stockRoutes.post(
  '/locations',
  authorize('stock:CREATE'),
  validate(createLocationSchema),
  auditAction('CREATE_LOCATION', 'stock'),
  StockController.createLocation
);
stockRoutes.get(
  '/locations/:id/delete-check',
  authorize('stock:READ'),
  StockController.checkLocationDelete
);
stockRoutes.get('/locations/:id', authorize('stock:READ'), StockController.findLocation);
stockRoutes.put(
  '/locations/:id',
  authorize('stock:UPDATE'),
  validate(updateLocationSchema),
  auditAction('UPDATE_LOCATION', 'stock'),
  StockController.updateLocation
);
stockRoutes.delete(
  '/locations/:id',
  authorize('stock:DELETE'),
  auditAction('DELETE_LOCATION', 'stock'),
  StockController.deleteLocation
);
stockRoutes.get('/items', authorize('stock:READ'), StockController.listItems);

export { stockRoutes };
