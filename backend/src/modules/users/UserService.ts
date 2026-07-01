import { prisma } from '../../database/prisma';
import { hashPassword } from '../../shared/utils/password';
import { NotFoundError, ValidationError, ForbiddenError } from '../../shared/errors/AppError';
import { parsePagination, buildPaginatedResult } from '../../shared/utils/pagination';
import { Prisma, RoleName } from '@prisma/client';
import type { createUserSchema, updateUserSchema } from './users.dto';
import { z } from 'zod';
import { ASSIGNABLE_ROLES, OPERACIONAL_PERMISSIONS, GERENCIA_PERMISSIONS, ROLE_DEFAULT_PERMISSIONS } from '../../shared/constants/roles';
import { MODULE_LABELS, ACTION_LABELS } from '../../shared/constants/permissionCatalog';
import { resolvePermissionsFromUser } from '../../shared/utils/permissionResolver';

type AuthActor = {
  id?: string;
  roleName: RoleName;
};

type CreateUserDTO = z.infer<typeof createUserSchema>;
type UpdateUserDTO = z.infer<typeof updateUserSchema>;

export class UserService {
  private static assertCanManageUsers(actor?: AuthActor) {
    if (!actor || actor.roleName !== 'ADMINISTRADOR') {
      throw new ForbiddenError('Apenas administradores podem gerenciar usuários');
    }
  }

  private static assertAssignableRole(roleName: RoleName, actor?: AuthActor) {
    this.assertCanManageUsers(actor);
    if (!ASSIGNABLE_ROLES.includes(roleName)) {
      throw new ValidationError('Perfil inválido. Use Administrador, Gerência ou Operacional.');
    }
  }

  private static async syncCustomPermissions(userId: string, permissionKeys: string[]) {
    const uniqueKeys = [...new Set(permissionKeys)];
    const all = await prisma.permission.findMany();
    const byKey = new Map(all.map((p) => [`${p.module}:${p.action}`, p]));
    const permissions = uniqueKeys.map((key) => {
      const perm = byKey.get(key);
      if (!perm) throw new ValidationError(`Permissão inválida: ${key}`);
      return perm;
    });

    await prisma.$transaction([
      prisma.userPermission.deleteMany({ where: { userId } }),
      prisma.userPermission.createMany({
        data: permissions.map((p) => ({ userId, permissionId: p.id })),
      }),
    ]);
  }

  static async listPermissionCatalog() {
    const permissions = await prisma.permission.findMany({
      orderBy: [{ module: 'asc' }, { action: 'asc' }],
    });

    const byModule: Record<
      string,
      { module: string; label: string; permissions: { key: string; action: string; label: string }[] }
    > = {};

    for (const p of permissions) {
      if (!byModule[p.module]) {
        byModule[p.module] = {
          module: p.module,
          label: MODULE_LABELS[p.module] ?? p.module,
          permissions: [],
        };
      }
      byModule[p.module].permissions.push({
        key: `${p.module}:${p.action}`,
        action: p.action,
        label: ACTION_LABELS[p.action] ?? p.action,
      });
    }

    return {
      modules: Object.values(byModule),
      defaultOperacional: [...OPERACIONAL_PERMISSIONS],
      defaultGerencia: [...GERENCIA_PERMISSIONS],
      defaultByRole: {
        OPERACIONAL: [...ROLE_DEFAULT_PERMISSIONS.OPERACIONAL],
        GERENCIA: [...ROLE_DEFAULT_PERMISSIONS.GERENCIA],
      },
    };
  }

  static async list(filters: {
    page?: string;
    limit?: string;
    search?: string;
    role?: string;
    active?: string;
    includeInactive?: string;
  }) {
    const pagination = parsePagination(filters.page, filters.limit);
    const where: Prisma.UserWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.includeInactive !== 'true') {
      where.active = true;
    } else if (filters.active === 'true' || filters.active === 'false') {
      where.active = filters.active === 'true';
    }
    if (filters.role) {
      where.role = { name: filters.role as RoleName };
    }

    const [data, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: { name: 'asc' },
        select: {
          id: true,
          name: true,
          email: true,
          active: true,
          useCustomAccess: true,
          role: { select: { id: true, name: true, description: true } },
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    return buildPaginatedResult(data, total, pagination);
  }

  static async findById(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
        customPermissions: { include: { permission: true } },
      },
    });
    if (!user) throw new NotFoundError('Usuário não encontrado');

    const rolePermissions = user.role.permissions.map(
      (rp) => `${rp.permission.module}:${rp.permission.action}`
    );
    const customPermissions = user.customPermissions.map(
      (up) => `${up.permission.module}:${up.permission.action}`
    );
    const effectivePermissions = resolvePermissionsFromUser(user);

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      active: user.active,
      useCustomAccess: user.useCustomAccess,
      role: {
        id: user.role.id,
        name: user.role.name,
        description: user.role.description,
      },
      rolePermissions,
      customPermissions,
      effectivePermissions,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static async create(data: CreateUserDTO, actor?: AuthActor) {
    const isAdmin = data.roleName === 'ADMINISTRADOR';
    if (isAdmin) {
      this.assertCanManageUsers(actor);
    } else {
      this.assertAssignableRole(data.roleName, actor);
    }

    const exists = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });
    if (exists) throw new ValidationError('E-mail já cadastrado');

    const role = await prisma.role.findUnique({ where: { name: data.roleName } });
    if (!role) throw new NotFoundError('Perfil não encontrado');

    const useCustomAccess =
      !isAdmin && (data.useCustomAccess ?? false) && (data.permissions?.length ?? 0) > 0;

    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email.toLowerCase(),
        password: await hashPassword(data.password),
        roleId: role.id,
        active: data.active ?? true,
        useCustomAccess,
      },
    });

    if (useCustomAccess && data.permissions) {
      await this.syncCustomPermissions(user.id, data.permissions);
    }

    return this.findById(user.id);
  }

  static async update(id: string, data: UpdateUserDTO, actor?: AuthActor) {
    const existing = await prisma.user.findUnique({
      where: { id },
      include: { role: true },
    });
    if (!existing) throw new NotFoundError('Usuário não encontrado');

    const targetRole = data.roleName ?? existing.role.name;
    if (targetRole === 'ADMINISTRADOR') {
      this.assertCanManageUsers(actor);
    } else if (data.roleName) {
      this.assertAssignableRole(data.roleName, actor);
    } else {
      this.assertCanManageUsers(actor);
    }

    if (actor?.id === id && data.roleName && data.roleName !== 'ADMINISTRADOR') {
      throw new ValidationError('Você não pode remover seu próprio perfil de administrador');
    }

    const updateData: Prisma.UserUpdateInput = {};
    if (data.name) updateData.name = data.name;
    if (data.email) updateData.email = data.email.toLowerCase();
    if (data.password) updateData.password = await hashPassword(data.password);
    if (data.active !== undefined) updateData.active = data.active;

    if (data.roleName) {
      const role = await prisma.role.findUnique({ where: { name: data.roleName } });
      if (!role) throw new NotFoundError('Perfil não encontrado');
      updateData.role = { connect: { id: role.id } };
    }

    const isAdmin = targetRole === 'ADMINISTRADOR';

    if (isAdmin) {
      updateData.useCustomAccess = false;
    } else if (data.useCustomAccess !== undefined) {
      updateData.useCustomAccess = data.useCustomAccess;
    }

    await prisma.user.update({ where: { id }, data: updateData });

    const refreshed = await prisma.user.findUnique({ where: { id } });
    const useCustom =
      isAdmin ? false : (data.useCustomAccess ?? refreshed?.useCustomAccess ?? false);

    if (isAdmin) {
      await prisma.userPermission.deleteMany({ where: { userId: id } });
    } else if (useCustom && data.permissions) {
      if (data.permissions.length === 0) {
        throw new ValidationError('Selecione ao menos uma permissão no acesso personalizado');
      }
      await prisma.user.update({ where: { id }, data: { useCustomAccess: true } });
      await this.syncCustomPermissions(id, data.permissions);
    } else if (data.useCustomAccess === false) {
      await prisma.userPermission.deleteMany({ where: { userId: id } });
    }

    return this.findById(id);
  }

  static async delete(id: string, actor?: AuthActor) {
    this.assertCanManageUsers(actor);
    if (actor?.id === id) {
      throw new ValidationError('Você não pode desativar sua própria conta');
    }
    await this.findById(id);
    await prisma.user.update({ where: { id }, data: { active: false } });
    return { message: 'Usuário desativado' };
  }

  static async listRoles(assignableOnly = false) {
    return prisma.role.findMany({
      where: assignableOnly ? { name: { in: ASSIGNABLE_ROLES } } : undefined,
      orderBy: { name: 'asc' },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
  }
}
