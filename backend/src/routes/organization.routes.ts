import { Router } from 'express';
import { OrganizationController } from '../modules/organization/OrganizationController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { updateOrganizationSchema } from '../modules/organization/organization.dto';
import { auditAction } from '../middlewares/audit';

const organizationRoutes = Router();

organizationRoutes.use(authenticate);

organizationRoutes.get('/', authorize('settings:READ'), OrganizationController.get);
organizationRoutes.put(
  '/',
  authorize('settings:UPDATE'),
  validate(updateOrganizationSchema),
  auditAction('UPDATE_ORGANIZATION', 'settings'),
  OrganizationController.update
);

export { organizationRoutes };
