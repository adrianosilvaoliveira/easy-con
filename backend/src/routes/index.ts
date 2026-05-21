import { Router } from 'express';
import { authRoutes } from './auth.routes';
import { userRoutes } from './user.routes';
import { productRoutes } from './product.routes';
import { stockRoutes } from './stock.routes';
import { movementRoutes } from './movement.routes';
import { inventoryRoutes } from './inventory.routes';
import { dashboardRoutes } from './dashboard.routes';
import { reportRoutes } from './report.routes';
import { auditRoutes } from './audit.routes';
import { supplierRoutes } from './supplier.routes';
import { batchesRoutes } from './batches.routes';
import { organizationRoutes } from './organization.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/products', productRoutes);
router.use('/stock', stockRoutes);
router.use('/movements', movementRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/reports', reportRoutes);
router.use('/audit', auditRoutes);
router.use('/suppliers', supplierRoutes);
router.use('/batches', batchesRoutes);
router.use('/organization', organizationRoutes);

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export { router as apiRoutes };
