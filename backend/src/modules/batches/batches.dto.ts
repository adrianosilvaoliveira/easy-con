import { z } from 'zod';
import { ExpirationStatus, ExpirationAlertType } from '@prisma/client';

export const createBatchSchema = z.object({
  productId: z.string().uuid(),
  stockLocationId: z.string().uuid(),
  batchNumber: z.string().min(1).max(50),
  expirationDate: z.string(),
  manufacturingDate: z.string().optional(),
  quantity: z.number().int().min(0).default(0),
  supplierId: z.string().uuid().optional(),
  unitCost: z.number().positive().optional(),
});

export const updateBatchSchema = createBatchSchema.partial().omit({ productId: true });

export const listBatchesSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  stockLocationId: z.string().uuid().optional(),
  batchNumber: z.string().optional(),
  status: z.nativeEnum(ExpirationStatus).optional(),
  expirationFrom: z.string().optional(),
  expirationTo: z.string().optional(),
  expiringDays: z.coerce.number().optional(),
  includeInactive: z.string().optional(),
});

export const reportFiltersSchema = z.object({
  productId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  supplierId: z.string().uuid().optional(),
  stockLocationId: z.string().uuid().optional(),
  batchNumber: z.string().optional(),
  status: z.nativeEnum(ExpirationStatus).optional(),
  expirationFrom: z.string().optional(),
  expirationTo: z.string().optional(),
  expiringDays: z.coerce.number().optional(),
  includeInactive: z.string().optional(),
});
