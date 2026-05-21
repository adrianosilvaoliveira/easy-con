import { Request, Response } from 'express';
import { OrganizationService } from './OrganizationService';

export class OrganizationController {
  static async get(_req: Request, res: Response): Promise<void> {
    const data = await OrganizationService.get();
    res.json({ success: true, data });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const data = await OrganizationService.update(req.body);
    res.json({ success: true, data });
  }
}
