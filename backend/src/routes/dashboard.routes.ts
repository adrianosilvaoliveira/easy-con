import { Router } from 'express';
import { DashboardController } from '../modules/dashboard/DashboardController';
import { authenticate, authorize } from '../middlewares/auth';

const dashboardRoutes = Router();

dashboardRoutes.use(authenticate);
dashboardRoutes.get('/', authorize('dashboard:READ'), DashboardController.getMetrics);
dashboardRoutes.get(
  '/entries-exits-chart',
  authorize('dashboard:READ'),
  DashboardController.getEntriesExitsChart
);

export { dashboardRoutes };
