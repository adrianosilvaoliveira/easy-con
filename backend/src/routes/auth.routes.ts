import { Router } from 'express';
import { AuthController } from '../modules/auth/AuthController';
import { validate } from '../middlewares/validate';
import {
  loginSchema,
  refreshTokenSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../modules/auth/auth.dto';
import { authenticate } from '../middlewares/auth';

const authRoutes = Router();

/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login
 */
authRoutes.post('/login', validate(loginSchema), AuthController.login);
authRoutes.post('/refresh', validate(refreshTokenSchema), AuthController.refresh);
authRoutes.post('/logout', validate(refreshTokenSchema), AuthController.logout);
authRoutes.post('/forgot-password', validate(forgotPasswordSchema), AuthController.forgotPassword);
authRoutes.post('/reset-password', validate(resetPasswordSchema), AuthController.resetPassword);
authRoutes.get('/me', authenticate, AuthController.me);

export { authRoutes };
