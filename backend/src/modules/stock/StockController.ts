import { Request, Response } from 'express';
import { StockService } from './StockService';
import { getParam } from '../../shared/utils/params';

export class StockController {
  static async listLocations(req: Request, res: Response): Promise<void> {
    const result = await StockService.listLocations(req.query as Record<string, string>);
    res.json({ success: true, data: result });
  }

  static async createLocation(req: Request, res: Response): Promise<void> {
    const result = await StockService.createLocation(req.body);
    res.status(201).json({ success: true, data: result });
  }

  static async updateLocation(req: Request, res: Response): Promise<void> {
    const result = await StockService.updateLocation(getParam(req, 'id'), req.body);
    res.json({ success: true, data: result });
  }

  static async deleteLocation(req: Request, res: Response): Promise<void> {
    const result = await StockService.deleteLocation(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }

  static async checkLocationDelete(req: Request, res: Response): Promise<void> {
    const result = await StockService.getLocationDeleteCheck(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }

  static async findLocation(req: Request, res: Response): Promise<void> {
    const result = await StockService.findLocation(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }

  static async listItems(req: Request, res: Response): Promise<void> {
    const result = await StockService.listStockItems(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }

  static async getAlerts(_req: Request, res: Response): Promise<void> {
    const result = await StockService.getAlerts();
    res.json({ success: true, data: result });
  }
}
