import { Request, Response } from 'express';
import { MovementService } from './MovementService';
import { getParam } from '../../shared/utils/params';

export class MovementController {
  static async createEntry(req: Request, res: Response): Promise<void> {
    const result = await MovementService.createEntry(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  }

  static async createExit(req: Request, res: Response): Promise<void> {
    const result = await MovementService.createExit(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  }

  static async createTransfer(req: Request, res: Response): Promise<void> {
    const result = await MovementService.createTransfer(req.body, req.user!.id);
    res.status(201).json({ success: true, data: result });
  }

  static async approveMovement(req: Request, res: Response): Promise<void> {
    const { approved, notes } = req.body;
    const result = await MovementService.approveMovement(
      getParam(req, 'id'),
      approved,
      req.user!.id,
      notes
    );
    res.json({ success: true, data: result });
  }

  static async approveTransfer(req: Request, res: Response): Promise<void> {
    return MovementController.approveMovement(req, res);
  }

  static async list(req: Request, res: Response): Promise<void> {
    const result = await MovementService.list(req.query as Record<string, string>);
    res.json({ success: true, ...result });
  }

  static async findById(req: Request, res: Response): Promise<void> {
    const result = await MovementService.findById(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }

  static async delete(req: Request, res: Response): Promise<void> {
    const result = await MovementService.delete(getParam(req, 'id'));
    res.json({ success: true, data: result });
  }
}
