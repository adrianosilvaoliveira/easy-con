import { Router } from 'express';
import { ReportController } from '../modules/reports/ReportController';
import { authenticate, authorize } from '../middlewares/auth';

const reportRoutes = Router();

reportRoutes.use(authenticate);

reportRoutes.get('/:type/preview', authorize('reports:READ'), ReportController.preview);

reportRoutes.get('/movements/pdf', authorize('reports:EXPORT'), ReportController.movements);
reportRoutes.get('/entries/pdf', authorize('reports:EXPORT'), ReportController.entries);
reportRoutes.get('/exits/pdf', authorize('reports:EXPORT'), ReportController.exits);
reportRoutes.get('/expiring/pdf', authorize('reports:EXPORT'), ReportController.expiring);
reportRoutes.get('/expired/pdf', authorize('reports:EXPORT'), ReportController.expired);
reportRoutes.get('/batches/pdf', authorize('reports:EXPORT'), ReportController.batches);
reportRoutes.get('/by-location/pdf', authorize('reports:EXPORT'), ReportController.byLocation);
reportRoutes.get('/discarded/pdf', authorize('reports:EXPORT'), ReportController.discarded);
reportRoutes.get('/loss-history/pdf', authorize('reports:EXPORT'), ReportController.lossHistory);
reportRoutes.get('/expiration-audit/pdf', authorize('reports:EXPORT'), ReportController.expirationAudit);
reportRoutes.get('/below-min/pdf', authorize('reports:EXPORT'), ReportController.belowMin);
reportRoutes.get('/audit/pdf', authorize('reports:EXPORT'), ReportController.audit);
reportRoutes.get('/consumption/pdf', authorize('reports:EXPORT'), ReportController.monthlyConsumption);

export { reportRoutes };
