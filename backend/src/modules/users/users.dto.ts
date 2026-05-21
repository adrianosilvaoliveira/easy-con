import { z } from 'zod';
import { RoleName } from '@prisma/client';

const permissionKeySchema = z
  .string()
  .regex(/^[a-z_]+:(READ|CREATE|UPDATE|DELETE|APPROVE|EXPORT)$/);

export const createUserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  roleName: z.nativeEnum(RoleName),
  active: z.boolean().optional().default(true),
  useCustomAccess: z.boolean().optional().default(false),
  permissions: z.array(permissionKeySchema).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  roleName: z.nativeEnum(RoleName).optional(),
  active: z.boolean().optional(),
  useCustomAccess: z.boolean().optional(),
  permissions: z.array(permissionKeySchema).optional(),
});

export const listUsersSchema = z.object({
  page: z.string().optional(),
  limit: z.string().optional(),
  search: z.string().optional(),
  role: z.nativeEnum(RoleName).optional(),
  active: z.string().optional(),
  includeInactive: z.string().optional(),
});
