import { Request, Response, NextFunction } from 'express';
import { AuditService } from '../services/AuditService';

export function auditAction(action: string, module: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const originalJson = res.json.bind(res);

    res.json = function (body: unknown) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        AuditService.log({
          userId: req.user?.id,
          action,
          module,
          entityId: (body as { data?: { id?: string } })?.data?.id,
          details: { method: req.method, path: req.path, body: req.body },
          ipAddress: req.ip,
          userAgent: req.get('user-agent') || undefined,
        }).catch(() => undefined);
      }
      return originalJson(body);
    };

    next();
  };
}
