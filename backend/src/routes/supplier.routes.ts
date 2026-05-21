import { Router } from 'express';
import { SupplierController } from '../modules/suppliers/SupplierController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createSupplierSchema, updateSupplierSchema } from '../modules/suppliers/suppliers.dto';
import { auditAction } from '../middlewares/audit';

const supplierRoutes = Router();

supplierRoutes.use(authenticate);

supplierRoutes.get('/', authorize('products:READ'), SupplierController.list);
supplierRoutes.get('/:id', authorize('products:READ'), SupplierController.findById);
supplierRoutes.post(
  '/',
  authorize('products:CREATE'),
  validate(createSupplierSchema),
  auditAction('CREATE_SUPPLIER', 'products'),
  SupplierController.create
);
supplierRoutes.put(
  '/:id',
  authorize('products:UPDATE'),
  validate(updateSupplierSchema),
  auditAction('UPDATE_SUPPLIER', 'products'),
  SupplierController.update
);
supplierRoutes.delete(
  '/:id',
  authorize('products:DELETE'),
  auditAction('DELETE_SUPPLIER', 'products'),
  SupplierController.delete
);

export { supplierRoutes };
