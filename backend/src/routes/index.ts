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
import { prisma } from '../database/prisma';
import { BatchService } from '../modules/batches/BatchService';

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

router.get('/cron/expiration', async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    const secret = process.env.CRON_SECRET;

    if (process.env.NODE_ENV === 'production' && !secret) {
      res.status(500).json({ success: false, message: 'Cron não configurado' });
      return;
    }

    if (secret && auth !== `Bearer ${secret}`) {
      res.status(401).json({ success: false, message: 'Não autorizado' });
      return;
    }

    const result = await BatchService.runExpirationJob();
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.get('/health/ready', async (_req, res) => {
  const dbHost =
    ((process.env.DATABASE_URL || '').match(/@([^:/?]+)/) || [])[1] || null;
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      database: 'up',
      dbHost,
      timestamp: new Date().toISOString(),
    });
  } catch {
    res.status(503).json({
      status: 'degraded',
      database: 'down',
      dbHost,
      timestamp: new Date().toISOString(),
    });
  }
});

export { router as apiRoutes };
