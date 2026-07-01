import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../shared/errors/AppError';
import { JwtProvider } from '../providers/JwtProvider';
import { prisma } from '../database/prisma';
import { resolvePermissionsFromUser } from '../shared/utils/permissionResolver';
import { isPrismaConnectionError } from '../shared/utils/prismaErrors';

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedError('Token não fornecido');
    }

    const token = authHeader.split(' ')[1];
    const payload = JwtProvider.verifyAccessToken(token);

    const user = await prisma.user.findUnique({
      where: { id: payload.sub, active: true },
      include: {
        role: {
          include: {
            permissions: { include: { permission: true } },
          },
        },
        customPermissions: { include: { permission: true } },
      },
    });

    if (!user) {
      throw new UnauthorizedError('Usuário inválido ou inativo');
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      roleName: user.role.name,
      permissions: resolvePermissionsFromUser(user),
    };

    next();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      next(error);
      return;
    }
    if (isPrismaConnectionError(error)) {
      next(error);
      return;
    }
    next(new UnauthorizedError('Token inválido ou expirado'));
  }
}

export function authorize(...requiredPermissions: string[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new UnauthorizedError());
      return;
    }

    if (req.user.roleName === 'ADMINISTRADOR') {
      next();
      return;
    }

    const hasPermission = requiredPermissions.some((perm) =>
      req.user!.permissions.includes(perm)
    );

    if (!hasPermission) {
      next(new ForbiddenError('Permissão insuficiente para esta operação'));
      return;
    }

    next();
  };
}
