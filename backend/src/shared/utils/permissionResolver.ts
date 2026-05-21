import { RoleName } from '@prisma/client';
import { prisma } from '../../database/prisma';

function toPermissionKey(module: string, action: string) {
  return `${module}:${action}`;
}

type UserWithPermissions = {
  role: {
    name: RoleName;
    permissions: { permission: { module: string; action: string } }[];
  };
  useCustomAccess: boolean;
  customPermissions: { permission: { module: string; action: string } }[];
};

export function resolvePermissionsFromUser(user: UserWithPermissions): string[] {
  if (user.role.name === 'ADMINISTRADOR') {
    return [];
  }

  if (user.useCustomAccess) {
    return user.customPermissions.map((up) =>
      toPermissionKey(up.permission.module, up.permission.action)
    );
  }

  return user.role.permissions.map((rp) =>
    toPermissionKey(rp.permission.module, rp.permission.action)
  );
}

const userPermissionInclude = {
  role: {
    include: {
      permissions: { include: { permission: true } },
    },
  },
  customPermissions: { include: { permission: true } },
} as const;

export async function loadUserPermissionContext(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: userPermissionInclude,
  });
}

export async function resolveUserPermissions(userId: string): Promise<string[]> {
  const user = await loadUserPermissionContext(userId);
  if (!user) return [];
  return resolvePermissionsFromUser(user);
}
