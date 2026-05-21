import { z } from 'zod';
import { StockLocationType } from '@prisma/client';

export const createLocationSchema = z.object({
  name: z.string().min(2).max(100),
  code: z.string().min(1).max(20),
  type: z.nativeEnum(StockLocationType),
  description: z.string().optional(),
});

export const updateLocationSchema = createLocationSchema.partial().extend({
  active: z.boolean().optional(),
});
