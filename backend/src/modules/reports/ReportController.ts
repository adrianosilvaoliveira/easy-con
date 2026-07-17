import { Request, Response } from 'express';
import { ReportService } from './ReportService';
import { ReportPreviewService, isValidReportType } from './ReportPreviewService';
import { ValidationError } from '../../shared/errors/AppError';
import { getParam } from '../../shared/utils/params';

export class ReportController {
  static async preview(req: Request, res: Response): Promise<void> {
    const type = getParam(req, 'type');
    if (!isValidReportType(type)) {
      throw new ValidationError('Tipo de relatório inválido');
    }
    const data = await ReportPreviewService.getPreview(
      type,
      req.query as Record<string, string | undefined>
    );
    res.json({ success: true, data });
  }

  static async stock(req: Request, res: Response): Promise<void> {
    await ReportService.stockPdf(res, req.user?.name);
  }

  static async movements(req: Request, res: Response): Promise<void> {
    await ReportService.movementsPdf(res, req.query as Record<string, string>, req.user?.name);
  }

  static async entries(req: Request, res: Response): Promise<void> {
    await ReportService.entriesPdf(res, req.query as Record<string, string>, req.user?.name);
  }

  static async exits(req: Request, res: Response): Promise<void> {
    await ReportService.exitsPdf(res, req.query as Record<string, string>, req.user?.name);
  }

  static async expiring(req: Request, res: Response): Promise<void> {
    await ReportService.expiringPdf(res, req.query as Record<string, string>, req.user?.name);
  }

  static async expired(req: Request, res: Response): Promise<void> {
    await ReportService.expiredPdf(res, req.query as Record<string, string>, req.user?.name);
  }

  static async batches(req: Request, res: Response): Promise<void> {
    await ReportService.batchesPdf(res, req.query as Record<string, string>, req.user?.name);
  }

  static async byLocation(req: Request, res: Response): Promise<void> {
    await ReportService.byLocationPdf(res, req.query as Record<string, string>, req.user?.name);
  }

  static async discarded(req: Request, res: Response): Promise<void> {
    await ReportService.discardedPdf(res, req.query as Record<string, string>, req.user?.name);
  }

  static async lossHistory(req: Request, res: Response): Promise<void> {
    await ReportService.lossHistoryPdf(res, req.query as Record<string, string>, req.user?.name);
  }

  static async expirationAudit(req: Request, res: Response): Promise<void> {
    await ReportService.expirationAuditPdf(res, req.query as Record<string, string>, req.user?.name);
  }

  static async belowMin(req: Request, res: Response): Promise<void> {
    await ReportService.belowMinPdf(res, req.user?.name);
  }

  static async audit(req: Request, res: Response): Promise<void> {
    await ReportService.auditPdf(res, req.query as Record<string, string>, req.user?.name);
  }

  static async monthlyConsumption(req: Request, res: Response): Promise<void> {
    await ReportService.monthlyConsumptionPdf(res, req.user?.name);
  }
}
