import { z } from 'zod';

export const updateOrganizationSchema = z.object({
  name: z.string().min(2, 'Nome obrigatório').max(200),
  cnpj: z.string().max(20).optional().nullable(),
  address: z.string().max(500).optional().nullable(),
  phone: z.string().max(30).optional().nullable(),
  email: z
    .union([z.string().email('E-mail inválido'), z.literal('')])
    .optional()
    .nullable(),
});

export type UpdateOrganizationDto = z.infer<typeof updateOrganizationSchema>;
