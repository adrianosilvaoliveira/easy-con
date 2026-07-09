import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { AuthController } from '../modules/auth/AuthController';
import { validate } from '../middlewares/validate';
import {
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateAvatarSchema,
} from '../modules/auth/auth.dto';
import { authenticate } from '../middlewares/auth';
import { asyncHandler } from '../middlewares/asyncHandler';

const isVercel = !!process.env.VERCEL;

/** Limite restritivo contra brute force em credenciais (por IP). */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Muitas tentativas. Tente novamente mais tarde.' },
  standardHeaders: true,
  legacyHeaders: false,
  validate: isVercel ? { xForwardedForHeader: false } : undefined,
});

const authRoutes = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 */
authRoutes.post('/login', authLimiter, validate(loginSchema), asyncHandler(AuthController.login));
authRoutes.post('/refresh', authLimiter, validate(refreshTokenSchema), asyncHandler(AuthController.refresh));
authRoutes.post('/logout', validate(refreshTokenSchema), asyncHandler(AuthController.logout));
authRoutes.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), asyncHandler(AuthController.forgotPassword));
authRoutes.post('/reset-password', validate(resetPasswordSchema), asyncHandler(AuthController.resetPassword));
authRoutes.get('/me', authenticate, asyncHandler(AuthController.me));
authRoutes.put(
  '/me/avatar',
  authenticate,
  validate(updateAvatarSchema),
  asyncHandler(AuthController.updateAvatar)
);
authRoutes.delete('/me/avatar', authenticate, asyncHandler(AuthController.removeAvatar));

export { authRoutes };
