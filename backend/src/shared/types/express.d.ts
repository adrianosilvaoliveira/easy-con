import { RoleName } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: RoleName;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      requestId?: string;
    }
  }
}

export {};
