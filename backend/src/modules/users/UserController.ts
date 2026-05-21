import { Request, Response } from 'express';
import { UserService } from './UserService';
import { getParam } from '../../shared/utils/params';

export class UserController {
  static async list(req: Request, res: Response): Promise<void> {
    const result = await UserService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }

  static async findById(req: Request, res: Response): Promise<void> {
    const result = await UserService.findById(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const result = await UserService.create(req.body, req.user);
    res.status(201).json({ success: true, data: result });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const result = await UserService.update(getParam(req, 'id'), req.body, req.user);
    res.json({ success: true, data: result });
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const result = await UserService.delete(getParam(req, 'id'), req.user);
    res.json({ success: true, data: result });
  }

  static async listRoles(req: Request, res: Response): Promise<void> {
    const assignableOnly = req.query.assignable === 'true';
    const result = await UserService.listRoles(assignableOnly);
    res.json({ success: true, data: result });
  }

  static async listPermissionCatalog(_req: Request, res: Response): Promise<void> {
    const result = await UserService.listPermissionCatalog();
    res.json({ success: true, data: result });
  }
}
