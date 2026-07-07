import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../../database/prisma';
import { comparePassword, hashPassword } from '../../shared/utils/password';
import { JwtProvider } from '../../providers/JwtProvider';
import { UnauthorizedError, NotFoundError, ValidationError } from '../../shared/errors/AppError';
import { AuditService } from '../../services/AuditService';
import { env } from '../../configs/env';
import type { LoginDTO, ForgotPasswordDTO, ResetPasswordDTO } from './auth.dto';
import { resolvePermissionsFromUser } from '../../shared/utils/permissionResolver';
import { Prisma } from '@prisma/client';

const userAuthInclude = {
  role: {
    include: {
      permissions: { include: { permission: true } },
    },
  },
  customPermissions: { include: { permission: true } },
} as const;

type UserWithAuthRelations = Prisma.UserGetPayload<{ include: typeof userAuthInclude }>;

export class AuthService {
  private static formatUserProfile(user: UserWithAuthRelations) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role.name,
      permissions: resolvePermissionsFromUser(user),
      useCustomAccess: user.useCustomAccess,
      avatarUrl: user.avatarUrl,
    };
  }

  static async login(data: LoginDTO, ip?: string, userAgent?: string) {
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
      include: userAuthInclude,
    });

    if (!user || !user.active) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    const valid = await comparePassword(data.password, user.password);
    if (!valid) {
      throw new UnauthorizedError('Credenciais inválidas');
    }

    const payload = { sub: user.id, email: user.email, roleId: user.roleId };
    const accessToken = JwtProvider.signAccessToken(payload);
    const refreshToken = JwtProvider.signRefreshToken(payload);

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: JwtProvider.decodeExpiresIn(env.JWT_REFRESH_EXPIRES_IN),
      },
    });

    await AuditService.log({
      userId: user.id,
      action: 'LOGIN',
      module: 'auth',
      ipAddress: ip,
      userAgent,
    });

    return {
      accessToken,
      refreshToken,
      user: this.formatUserProfile(user),
    };
  }

  static async refresh(refreshToken: string) {
    let payload: ReturnType<typeof JwtProvider.verifyRefreshToken>;
    try {
      payload = JwtProvider.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedError('Refresh token inválido ou expirado');
    }

    const stored = await prisma.refreshToken.findFirst({
      where: { token: refreshToken, userId: payload.sub, revoked: false },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedError('Refresh token inválido ou expirado');
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub, active: true },
    });

    if (!user) throw new UnauthorizedError('Usuário inválido');

    const tokenPayload = { sub: user.id, email: user.email, roleId: user.roleId };
    return {
      accessToken: JwtProvider.signAccessToken(tokenPayload),
      refreshToken,
    };
  }

  static async logout(refreshToken: string, userId?: string) {
    await prisma.refreshToken.updateMany({
      where: { token: refreshToken },
      data: { revoked: true },
    });

    if (userId) {
      await AuditService.log({
        userId,
        action: 'LOGOUT',
        module: 'auth',
      });
    }
  }

  static async forgotPassword(data: ForgotPasswordDTO) {
    const user = await prisma.user.findUnique({
      where: { email: data.email.toLowerCase() },
    });

    if (!user) {
      return { message: 'Se o e-mail existir, um link será enviado' };
    }

    const token = uuidv4();
    await prisma.passwordReset.create({
      data: {
        token,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    // Email would be sent via nodemailer in production
    return {
      message: 'Se o e-mail existir, um link será enviado',
      resetToken: env.NODE_ENV === 'development' ? token : undefined,
    };
  }

  static async resetPassword(data: ResetPasswordDTO) {
    const reset = await prisma.passwordReset.findFirst({
      where: { token: data.token, used: false, expiresAt: { gt: new Date() } },
    });

    if (!reset) throw new ValidationError('Token inválido ou expirado');

    const hashed = await hashPassword(data.password);
    await prisma.$transaction([
      prisma.user.update({
        where: { id: reset.userId },
        data: { password: hashed },
      }),
      prisma.passwordReset.update({
        where: { id: reset.id },
        data: { used: true },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: reset.userId },
        data: { revoked: true },
      }),
    ]);

    return { message: 'Senha alterada com sucesso' };
  }

  static async me(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: userAuthInclude,
    });

    if (!user) throw new NotFoundError('Usuário não encontrado');

    return this.formatUserProfile(user);
  }

  static async updateAvatar(userId: string, avatarUrl: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      include: userAuthInclude,
    });

    return this.formatUserProfile(user);
  }

  static async removeAvatar(userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      include: userAuthInclude,
    });

    return this.formatUserProfile(user);
  }
}
