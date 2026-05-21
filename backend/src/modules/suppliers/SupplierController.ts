import { Request, Response } from 'express';
import { SupplierService } from './SupplierService';
import { getParam } from '../../shared/utils/params';

export class SupplierController {
  static async list(req: Request, res: Response): Promise<void> {
    const data = await SupplierService.list(req.query as Record<string, string>);
    res.json({ success: true, data });
  }

  static async findById(req: Request, res: Response): Promise<void> {
    const data = await SupplierService.findById(getParam(req, 'id'));
    res.json({ success: true, data });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const data = await SupplierService.create(req.body);
    res.status(201).json({ success: true, data });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const data = await SupplierService.update(getParam(req, 'id'), req.body);
    res.json({ success: true, data });
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const data = await SupplierService.deactivate(getParam(req, 'id'));
    res.json({ success: true, data });
  }
}
