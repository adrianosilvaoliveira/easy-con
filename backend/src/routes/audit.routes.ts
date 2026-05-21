import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth';
import { AuditService } from '../services/AuditService';

const auditRoutes = Router();

auditRoutes.use(authenticate);
auditRoutes.get('/', authorize('audit:READ'), async (req, res) => {
  const result = await AuditService.list(req.query as Record<string, string>);
  res.json({ success: true, ...result });
});

export { auditRoutes };
