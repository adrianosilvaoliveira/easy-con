import { Request, Response } from 'express';
import { DashboardService } from './DashboardService';

export class DashboardController {
  static async getMetrics(_req: Request, res: Response): Promise<void> {
    const result = await DashboardService.getMetrics();
    res.json({ success: true, data: result });
  }

  static async getEntriesExitsChart(req: Request, res: Response): Promise<void> {
    const period = req.query.period as string | undefined;
    const result = await DashboardService.getEntriesExitsChart(period);
    res.json({ success: true, data: result });
  }
}
