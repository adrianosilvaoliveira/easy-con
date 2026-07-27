import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError, ForbiddenError } from '../shared/errors/AppError';
import { JwtProvider } from '../providers/JwtProvider';
import { prisma } from '../database/prisma';
import { resolvePermissionsFromUser } from '../shared/utils/permissionResolver';
import { isPrismaConnectionError, isTransientDbError } from '../shared/utils/prismaErrors';
import { AUTH_ACCOUNT_TTL_MS, CACHE_KEYS, memoryCache } from '../shared/cache/memoryCache';

interface AuthAccountSnapshot {
  permissionsVersion: number;
  active: true;
}

function applyJwtUser(
  req: Request,
  payload: ReturnType<typeof JwtProvider.verifyAccessToken>
): void {
  req.user = {
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    roleId: payload.roleId,
    roleName: payload.roleName,
    permissions: payload.permissions,
  };
}

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
    const cacheKey = CACHE_KEYS.authUser(payload.sub);
    const canUseJwtClaims =
      Array.isArray(payload.permissions) && Boolean(payload.roleName) && typeof payload.pv === 'number';

    /** Cache hit com mesma versão de permissões: zero query ao banco. */
    const cached = memoryCache.get<AuthAccountSnapshot>(cacheKey);
    if (cached && canUseJwtClaims && cached.permissionsVersion === payload.pv) {
      applyJwtUser(req, payload);
      next();
      return;
    }

    const account = await prisma.user.findUnique({
      where: { id: payload.sub, active: true },
      select: { id: true, permissionsVersion: true },
    });

    if (!account) {
      memoryCache.invalidate(cacheKey);
      throw new UnauthorizedError('Usuário inválido ou inativo');
    }

    memoryCache.set<AuthAccountSnapshot>(
      cacheKey,
      { permissionsVersion: account.permissionsVersion, active: true },
      AUTH_ACCOUNT_TTL_MS
    );

    /** Caminho rápido: token válido e permissões inalteradas — sem joins de permissões. */
    if (canUseJwtClaims && account.permissionsVersion === payload.pv) {
      applyJwtUser(req, payload);
      next();
      return;
    }

    /** Permissões mudaram desde a emissão do token: recarrega e re-resolve. */
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
      memoryCache.invalidate(cacheKey);
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
    if (isPrismaConnectionError(error) || isTransientDbError(error)) {
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
