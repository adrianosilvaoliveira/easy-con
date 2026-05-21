import { Request, Response } from 'express';
import { BatchService } from './BatchService';
import { AlertService } from './AlertService';
import { getParam } from '../../shared/utils/params';

export class BatchController {
  static async list(req: Request, res: Response): Promise<void> {
    const result = await BatchService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }

  static async expiring(req: Request, res: Response): Promise<void> {
    const days = Number(req.query.days) || 90;
    const result = await BatchService.listExpiring(days, req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }

  static async expired(req: Request, res: Response): Promise<void> {
    const result = await BatchService.listExpired(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }

  static async findById(req: Request, res: Response): Promise<void> {
    const result = await BatchService.findById(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }

  static async create(req: Request, res: Response): Promise<void> {
    const result = await BatchService.create(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  }

  static async update(req: Request, res: Response): Promise<void> {
    const result = await BatchService.update(getParam(req, 'id'), req.body, req.user!.id);
    res.json({ success: true, data: result });
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const result = await BatchService.delete(getParam(req, 'id'), req.user!.id);
    res.json({ success: true, data: result });
  }

  static async dashboard(req: Request, res: Response): Promise<void> {
    const result = await BatchService.getDashboardMetrics();
    res.json({ success: true, data: result });
  }

  static async listAlerts(req: Request, res: Response): Promise<void> {
    const result = await AlertService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }

  static async alertCount(req: Request, res: Response): Promise<void> {
    const count = await AlertService.countUnvisualized();
    res.json({ success: true, data: { count } });
  }

  static async markAlertRead(req: Request, res: Response): Promise<void> {
    const result = await AlertService.markVisualized(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }

  static async markAllAlertsRead(_req: Request, res: Response): Promise<void> {
    const result = await AlertService.markAllVisualized();
    res.json({ success: true, data: result });
  }
}
