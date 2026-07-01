import { Router } from 'express';
import { ProductController } from '../modules/products/ProductController';
import { authenticate, authorize } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { asyncHandler } from '../middlewares/asyncHandler';
import {
  createProductSchema,
  updateProductSchema,
  createBatchSchema,
} from '../modules/products/products.dto';
import { auditAction } from '../middlewares/audit';

const productRoutes = Router();

productRoutes.use(authenticate);

productRoutes.get('/search/global', authorize('products:READ'), asyncHandler(ProductController.globalSearch));
productRoutes.get('/categories', authorize('products:READ'), asyncHandler(ProductController.listCategories));
productRoutes.get(
  '/categories/:id/delete-check',
  authorize('products:READ'),
  asyncHandler(ProductController.checkCategoryDelete)
);
productRoutes.get('/categories/:id', authorize('products:READ'), asyncHandler(ProductController.findCategory));
productRoutes.post(
  '/categories',
  authorize('products:CREATE'),
  auditAction('CREATE_CATEGORY', 'products'),
  asyncHandler(ProductController.createCategory)
);
productRoutes.put(
  '/categories/:id',
  authorize('products:UPDATE'),
  auditAction('UPDATE_CATEGORY', 'products'),
  asyncHandler(ProductController.updateCategory)
);
productRoutes.delete(
  '/categories/:id',
  authorize('products:DELETE'),
  auditAction('DELETE_CATEGORY', 'products'),
  asyncHandler(ProductController.deleteCategory)
);
productRoutes.get('/', authorize('products:READ'), asyncHandler(ProductController.list));
productRoutes.get('/:id', authorize('products:READ'), asyncHandler(ProductController.findById));
productRoutes.post(
  '/',
  authorize('products:CREATE'),
  validate(createProductSchema),
  auditAction('CREATE_PRODUCT', 'products'),
  asyncHandler(ProductController.create)
);
productRoutes.put(
  '/:id',
  authorize('products:UPDATE'),
  validate(updateProductSchema),
  auditAction('UPDATE_PRODUCT', 'products'),
  asyncHandler(ProductController.update)
);
productRoutes.delete(
  '/:id',
  authorize('products:DELETE'),
  auditAction('DELETE_PRODUCT', 'products'),
  asyncHandler(ProductController.delete)
);
productRoutes.post(
  '/batches',
  authorize('products:CREATE'),
  validate(createBatchSchema),
  asyncHandler(ProductController.createBatch)
);

export { productRoutes };
