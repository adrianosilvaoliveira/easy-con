import { Router } from 'express';
import { ReportController } from '../modules/reports/ReportController';
import { authenticate, authorize } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/asyncHandler';

const reportRoutes = Router();

reportRoutes.use(authenticate);

reportRoutes.get('/:type/preview', authorize('reports:READ'), asyncHandler(ReportController.preview));

reportRoutes.get('/stock/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.stock));
reportRoutes.get('/movements/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.movements));
reportRoutes.get('/entries/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.entries));
reportRoutes.get('/exits/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.exits));
reportRoutes.get('/expiring/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.expiring));
reportRoutes.get('/expired/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.expired));
reportRoutes.get('/batches/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.batches));
reportRoutes.get('/by-location/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.byLocation));
reportRoutes.get('/discarded/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.discarded));
reportRoutes.get('/loss-history/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.lossHistory));
reportRoutes.get('/expiration-audit/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.expirationAudit));
reportRoutes.get('/below-min/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.belowMin));
reportRoutes.get('/audit/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.audit));
reportRoutes.get('/consumption/pdf', authorize('reports:EXPORT'), asyncHandler(ReportController.monthlyConsumption));

export { reportRoutes };
