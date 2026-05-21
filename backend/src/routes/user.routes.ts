import { Router } from 'express';
import { UserController } from '../modules/users/UserController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createUserSchema, updateUserSchema } from '../modules/users/users.dto';
import { auditAction } from '../middlewares/audit';

const userRoutes = Router();

userRoutes.use(authenticate);

userRoutes.get('/roles', authorize('users:READ'), UserController.listRoles);
userRoutes.get('/permissions/catalog', authorize('users:READ'), UserController.listPermissionCatalog);
userRoutes.get('/', authorize('users:READ'), UserController.list);
userRoutes.get('/:id', authorize('users:READ'), UserController.findById);
userRoutes.post(
  '/',
  authorize('users:CREATE'),
  validate(createUserSchema),
  auditAction('CREATE_USER', 'users'),
  UserController.create
);
userRoutes.put(
  '/:id',
  authorize('users:UPDATE'),
  validate(updateUserSchema),
  auditAction('UPDATE_USER', 'users'),
  UserController.update
);
userRoutes.delete(
  '/:id',
  authorize('users:DELETE'),
  auditAction('DELETE_USER', 'users'),
  UserController.delete
);

export { userRoutes };
