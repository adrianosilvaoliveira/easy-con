import jwt from 'jsonwebtoken';
import type { RoleName } from '@prisma/client';
import { env } from '../configs/env';

export interface TokenPayload {
  sub: string;
  email: string;
  roleId: string;
}

/** Claims embutidas no access token para evitar consulta de permissões por requisição. */
export interface AccessTokenPayload extends TokenPayload {
  name: string;
  roleName: RoleName;
  permissions: string[];
  pv: number;
}

export class JwtProvider {
  static signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  static signRefreshToken(payload: TokenPayload): string {
    return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    });
  }

  static verifyAccessToken(token: string): AccessTokenPayload {
    return jwt.verify(token, env.JWT_SECRET) as AccessTokenPayload;
  }

  static verifyRefreshToken(token: string): TokenPayload {
    return jwt.verify(token, env.JWT_REFRESH_SECRET) as TokenPayload;
  }

  static decodeExpiresIn(refreshExpires: string): Date {
    const match = refreshExpires.match(/^(\d+)([dhms])$/);
    if (!match) return new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60 * 1000,
      h: 60 * 60 * 1000,
      d: 24 * 60 * 60 * 1000,
    };
    return new Date(Date.now() + value * (multipliers[unit] || multipliers.d));
  }
}
