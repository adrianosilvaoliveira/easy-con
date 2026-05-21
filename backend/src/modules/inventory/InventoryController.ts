import { Request, Response } from 'express';
import { InventoryService } from './InventoryService';
import { getParam } from '../../shared/utils/params';

export class InventoryController {
  static async list(req: Request, res: Response): Promise<void> {
    const result = await InventoryService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const result = await InventoryService.create(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  }

  static async findById(req: Request, res: Response): Promise<void> {
    const result = await InventoryService.findById(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }

  static async updateItem(req: Request, res: Response): Promise<void> {
    const result = await InventoryService.addOrUpdateItem(getParam(req, 'id'), req.body);
    res.json({ success: true, data: result });
  }

  static async complete(req: Request, res: Response): Promise<void> {
    const autoAdjust = req.body.autoAdjust !== false;
    const result = await InventoryService.complete(
      getParam(req, 'id'),
      req.user!.id,
      autoAdjust
    );
    res.json({ success: true, data: result });
  }
}
