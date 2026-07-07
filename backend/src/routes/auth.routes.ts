import { Router } from 'express';
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

const authRoutes = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 */
authRoutes.post('/login', validate(loginSchema), asyncHandler(AuthController.login));
authRoutes.post('/refresh', validate(refreshTokenSchema), asyncHandler(AuthController.refresh));
authRoutes.post('/logout', validate(refreshTokenSchema), asyncHandler(AuthController.logout));
authRoutes.post('/forgot-password', validate(forgotPasswordSchema), asyncHandler(AuthController.forgotPassword));
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
