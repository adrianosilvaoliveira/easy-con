import { Request, Response } from 'express';
import { AuthService } from './AuthService';

export class AuthController {
  static async login(req: Request, res: Response): Promise<void> {
    const result = await AuthService.login(req.body, req.ip, req.get('user-agent') || undefined);
    res.json({ success: true, data: result });
  }

  static async refresh(req: Request, res: Response): Promise<void> {
    const result = await AuthService.refresh(req.body.refreshToken);
    res.json({ success: true, data: result });
  }

  static async logout(req: Request, res: Response): Promise<void> {
    await AuthService.logout(req.body.refreshToken, req.user?.id);
    res.json({ success: true, message: 'Logout realizado' });
  }

  static async forgotPassword(req: Request, res: Response): Promise<void> {
    const result = await AuthService.forgotPassword(req.body);
    res.json({ success: true, data: result });
  }

  static async resetPassword(req: Request, res: Response): Promise<void> {
    const result = await AuthService.resetPassword(req.body);
    res.json({ success: true, data: result });
  }

  static async me(req: Request, res: Response): Promise<void> {
    const result = await AuthService.me(req.user!.id);
    res.json({ success: true, data: result });
  }
}
