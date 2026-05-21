import { Router } from 'express';
import { ProductController } from '../modules/products/ProductController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  createProductSchema,
  updateProductSchema,
  createBatchSchema,
} from '../modules/products/products.dto';
import { auditAction } from '../middlewares/audit';
import { z } from 'zod';

const productRoutes = Router();

productRoutes.use(authenticate);

productRoutes.get('/search/global', authorize('products:READ'), ProductController.globalSearch);
productRoutes.get('/categories', authorize('products:READ'), ProductController.listCategories);
productRoutes.get(
  '/categories/:id/delete-check',
  authorize('products:READ'),
  ProductController.checkCategoryDelete
);
productRoutes.get('/categories/:id', authorize('products:READ'), ProductController.findCategory);
productRoutes.post(
  '/categories',
  authorize('products:CREATE'),
  auditAction('CREATE_CATEGORY', 'products'),
  ProductController.createCategory
);
productRoutes.put(
  '/categories/:id',
  authorize('products:UPDATE'),
  auditAction('UPDATE_CATEGORY', 'products'),
  ProductController.updateCategory
);
productRoutes.delete(
  '/categories/:id',
  authorize('products:DELETE'),
  auditAction('DELETE_CATEGORY', 'products'),
  ProductController.deleteCategory
);
productRoutes.get('/', authorize('products:READ'), ProductController.list);
productRoutes.get('/:id', authorize('products:READ'), ProductController.findById);
productRoutes.post(
  '/',
  authorize('products:CREATE'),
  validate(createProductSchema),
  auditAction('CREATE_PRODUCT', 'products'),
  ProductController.create
);
productRoutes.put(
  '/:id',
  authorize('products:UPDATE'),
  validate(updateProductSchema),
  auditAction('UPDATE_PRODUCT', 'products'),
  ProductController.update
);
productRoutes.delete(
  '/:id',
  authorize('products:DELETE'),
  auditAction('DELETE_PRODUCT', 'products'),
  ProductController.delete
);
productRoutes.post(
  '/batches',
  authorize('products:CREATE'),
  validate(createBatchSchema),
  ProductController.createBatch
);

export { productRoutes };
