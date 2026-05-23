import { z } from 'zod';
import { normalizeProductName } from '../../shared/utils/productName';

const productNameSchema = z
  .string()
  .min(2)
  .max(200)
  .transform(normalizeProductName);

export const createProductSchema = z.object({
  name: productNameSchema,
  internalCode: z.string().min(1).max(50),
  barcode: z.string().optional(),
  categoryId: z.string().uuid(),
  manufacturer: z.string().optional(),
  unit: z.string().default('UN'),
  minQuantity: z.number().int().min(0).default(0),
  location: z.string().optional(),
  notes: z.string().optional(),
});

export const updateProductSchema = createProductSchema.partial().extend({
  active: z.boolean().optional(),
});

export const createBatchSchema = z.object({
  productId: z.string().uuid(),
  lot: z.string().min(1),
  expiryDate: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  quantity: z.number().int().min(0).optional(),
  locationId: z.string().uuid().optional(),
});

export const listProductsSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  categoryId: z.string().optional(),
  active: z.string().optional(),
  belowMin: z.string().optional(),
  expiringDays: z.string().optional(),
});
