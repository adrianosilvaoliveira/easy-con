import { z } from 'zod';

export const createSupplierSchema = z.object({
  name: z.string().min(2).max(200),
  cnpj: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial().extend({
  active: z.boolean().optional(),
});
